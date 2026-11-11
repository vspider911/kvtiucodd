"""Приём заявки с сайта и пересылка в Telegram.

Этот файл работает в двух местах:
- на Vercel — как функция по адресу /api/contact (класс `handler` ниже);
- локально — его подключает main.py.

Токен бота и chat_id берутся из переменных окружения TG_BOT_TOKEN и TG_CHAT_ID
(локально — из файла .env, на Vercel — Settings → Environment Variables).

Защита от спама:
- скрытое поле-ловушка `website` и запрос без `elapsed` — заявка молча отбрасывается;
- форма отправлена быстрее 3 секунд после открытия страницы — просим подождать;
- контакт — только телефон или ник в Telegram, в сообщении не больше 2 ссылок;
- не больше 2 заявок за сутки с одного IP и с одного контакта;
- не больше 10 попыток за 10 минут с одного IP и 30 заявок в час всего;
- запросы с чужих сайтов (заголовок Origin) отклоняются.
Счётчики хранятся в памяти процесса: локально — пока работает main.py,
на Vercel — пока жив экземпляр функции.
"""

import json
import os
import re
import sys
import threading
import time
import urllib.request
from collections import defaultdict, deque
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse

MAX_BODY = 10_000       # максимальный размер заявки в байтах
MAX_FIELD = 2000        # максимальная длина одного поля

LIMIT_PER_CLIENT = 2            # заявок с одного IP / контакта
LIMIT_WINDOW = 24 * 3600        # … за сутки
ATTEMPTS_LIMIT = 10             # попыток с одного IP
ATTEMPTS_WINDOW = 10 * 60       # … за 10 минут
GLOBAL_LIMIT = 30               # заявок всего
GLOBAL_WINDOW = 3600            # … за час
MIN_FILL_MS = 3000              # быстрее — это бот
MAX_LINKS = 2                   # ссылок в сообщении

LIMIT_MESSAGE = 'Можно отправить не больше двух заявок. Ваши уже у меня, скоро свяжусь'

_lock = threading.Lock()
_sent_by_ip = defaultdict(deque)
_sent_by_contact = defaultdict(deque)
_attempts = defaultdict(deque)
_sent_global = deque()


def get_config():
    return (
        os.environ.get('TG_BOT_TOKEN', 'ВСТАВЬТЕ_ТОКЕН'),
        os.environ.get('TG_CHAT_ID', 'ВСТАВЬТЕ_CHAT_ID'),
    )


def is_configured():
    token, chat_id = get_config()
    return bool(token) and bool(chat_id) and 'ВСТАВЬТЕ' not in token and 'ВСТАВЬТЕ' not in chat_id


def log(message):
    print(message, file=sys.stderr)


def normalize_contact(value):
    """Телефон → 'tel:9261408245', ник/ссылка Telegram → 'tg:nick'. Иначе None."""
    value = value.strip()
    digits = re.sub(r'\D', '', value)
    if 10 <= len(digits) <= 15 and not re.search(r'[A-Za-zА-Яа-я]', value):
        return 'tel:' + digits[-10:]
    m = re.fullmatch(r'(?:https?://)?(?:t\.me/|@)?([A-Za-z][A-Za-z0-9_]{4,31})', value)
    if m:
        return 'tg:' + m.group(1).lower()
    return None


def count_links(text):
    return len(re.findall(r'https?://|www\.|t\.me/', text, re.IGNORECASE))


def _prune(store, key, window, now):
    dq = store[key]
    while dq and now - dq[0] > window:
        dq.popleft()
    if not dq:
        del store[key]
        return 0
    return len(dq)


def _prune_global(now):
    while _sent_global and now - _sent_global[0] > GLOBAL_WINDOW:
        _sent_global.popleft()


def send_to_telegram(data):
    token, chat_id = get_config()
    text = '\n'.join([
        '📩 Новая заявка с сайта',
        '',
        f"👤 Имя: {data['name']}",
        f"📞 Контакт: {data['contact']}",
        f"📂 Тип: {data['type'] or 'не указан'}",
        f"💬 Сообщение: {data['message']}",
        '',
        f"✅ Согласие на обработку ПД: дано {datetime.now(timezone.utc).isoformat(timespec='seconds')}",
    ])
    request = urllib.request.Request(
        f'https://api.telegram.org/bot{token}/sendMessage',
        data=json.dumps({'chat_id': chat_id, 'text': text}).encode(),
        headers={'Content-Type': 'application/json'},
    )
    with urllib.request.urlopen(request, timeout=10) as response:
        return json.load(response)


# Сайты на других адресах, которым можно слать заявки сюда (сайт на GitHub Pages, сервер на Vercel).
# Можно переопределить переменной окружения ALLOWED_ORIGINS через запятую.
DEFAULT_ORIGINS = 'https://vspider911.github.io'


def origin_allowed(origin):
    allowed = os.environ.get('ALLOWED_ORIGINS', DEFAULT_ORIGINS)
    return origin.rstrip('/').lower() in {o.strip().rstrip('/').lower() for o in allowed.split(',') if o.strip()}


def process(raw, ip='', origin='', host=''):
    """Проверяет заявку и отправляет её. Возвращает (HTTP-статус, ответ)."""
    now = time.time()
    ip = ip or 'unknown'

    # заявки только с нашего сайта: тот же адрес или сайт из списка ALLOWED_ORIGINS (GitHub Pages)
    if origin and host and urlparse(origin).netloc.lower() != host.lower() and not origin_allowed(origin):
        return 403, {'ok': False, 'error': 'Заявку можно отправить только с сайта'}

    # слишком много попыток с одного адреса
    with _lock:
        if _prune(_attempts, ip, ATTEMPTS_WINDOW, now) >= ATTEMPTS_LIMIT:
            return 429, {'ok': False, 'error': 'Слишком много попыток. Попробуйте позже'}
        _attempts[ip].append(now)

    try:
        data = json.loads(raw)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return 400, {'ok': False, 'error': 'Неверный формат'}
    if not isinstance(data, dict):
        return 400, {'ok': False, 'error': 'Неверный формат'}

    # ловушки для ботов: делаем вид, что всё хорошо, но ничего не отправляем
    if data.get('website'):
        log(f'Спам отсеян (ловушка), IP {ip}')
        return 200, {'ok': True}
    try:
        elapsed = float(data.get('elapsed'))
    except (TypeError, ValueError):
        # наша форма всегда присылает elapsed — без него пишет бот напрямую в API
        log(f'Спам отсеян (нет elapsed), IP {ip}')
        return 200, {'ok': True}
    if elapsed < MIN_FILL_MS:
        log(f'Слишком быстро: {elapsed:.0f} мс, IP {ip}')
        return 400, {'ok': False, 'error': 'Подождите пару секунд и отправьте ещё раз'}

    fields = {
        key: str(data.get(key, '')).strip()[:MAX_FIELD]
        for key in ('name', 'contact', 'type', 'message')
    }
    if not all(fields[key] for key in ('name', 'contact', 'message')):
        return 400, {'ok': False, 'error': 'Заполните имя, контакт и сообщение'}
    # без согласия на обработку персональных данных заявку не принимаем (152-ФЗ)
    if data.get('consent') != 'yes':
        return 400, {'ok': False, 'error': 'Нужно согласие на обработку персональных данных'}

    contact_key = normalize_contact(fields['contact'])
    if not contact_key:
        return 400, {'ok': False, 'error': 'Укажите телефон или ник в Telegram (например, @nickname)'}
    if count_links(fields['name']) or count_links(fields['message']) > MAX_LINKS:
        return 400, {'ok': False, 'error': 'Слишком много ссылок в заявке'}

    if not is_configured():
        log('Не заданы TG_BOT_TOKEN и TG_CHAT_ID (файл .env или переменные окружения)')
        return 503, {'ok': False, 'error': 'Бот не настроен'}

    # лимиты: не больше 2 заявок с одного IP и контакта, не больше 30 в час всего
    with _lock:
        if (_prune(_sent_by_ip, ip, LIMIT_WINDOW, now) >= LIMIT_PER_CLIENT
                or _prune(_sent_by_contact, contact_key, LIMIT_WINDOW, now) >= LIMIT_PER_CLIENT):
            return 429, {'ok': False, 'error': LIMIT_MESSAGE, 'limit': True}
        _prune_global(now)
        if len(_sent_global) >= GLOBAL_LIMIT:
            return 429, {'ok': False, 'error': 'Сейчас слишком много заявок. Попробуйте позже'}
        # занимаем место заранее, чтобы параллельные запросы не обошли лимит
        _sent_by_ip[ip].append(now)
        _sent_by_contact[contact_key].append(now)
        _sent_global.append(now)

    try:
        send_to_telegram(fields)
    except Exception as err:  # сеть, неверный токен и т. п.
        log(f'Ошибка отправки в Telegram: {err}')
        with _lock:  # заявка не ушла — возвращаем место
            for store, key in ((_sent_by_ip, ip), (_sent_by_contact, contact_key)):
                if store.get(key) and now in store[key]:
                    store[key].remove(now)
            if now in _sent_global:
                _sent_global.remove(now)
        return 502, {'ok': False, 'error': 'Не удалось отправить'}

    return 200, {'ok': True}


def client_ip_from_proxy(headers, fallback=''):
    """IP посетителя за прокси (Vercel ставит x-real-ip и x-forwarded-for)."""
    real = headers.get('x-real-ip')
    if real:
        return real.strip()
    fwd = headers.get('x-forwarded-for')
    if fwd:
        return fwd.split(',')[0].strip()
    return fallback


class handler(BaseHTTPRequestHandler):
    """Функция для Vercel: /api/contact."""

    def do_POST(self):
        length = int(self.headers.get('Content-Length') or 0)
        if length > MAX_BODY:
            return self.send_json(413, {'ok': False, 'error': 'Слишком большая заявка'})
        status, payload = process(
            self.rfile.read(length),
            ip=client_ip_from_proxy(self.headers, self.client_address[0] if self.client_address else ''),
            origin=self.headers.get('Origin', ''),
            host=self.headers.get('x-forwarded-host') or self.headers.get('Host', ''),
        )
        self.send_json(status, payload)

    def do_GET(self):
        self.send_json(405, {'ok': False, 'error': 'Только POST'})

    def do_OPTIONS(self):
        # предварительный запрос браузера перед заявкой с другого сайта (CORS)
        self.send_response(204)
        self.cors_headers()
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Access-Control-Max-Age', '86400')
        self.send_header('Content-Length', '0')
        self.end_headers()

    def cors_headers(self):
        origin = self.headers.get('Origin', '')
        if origin and origin_allowed(origin):
            self.send_header('Access-Control-Allow-Origin', origin)
            self.send_header('Vary', 'Origin')

    def send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(status)
        self.cors_headers()
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)
