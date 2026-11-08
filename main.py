"""Локальный сервер сайта: отдаёт страницы и пересылает заявки из формы в Telegram.

Запуск:  python main.py         →   http://localhost:8000
         python main.py 8010    →   на другом порту
"""

import importlib.util
import json
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import PurePosixPath
from urllib.parse import unquote, urlparse

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# консоль Windows по умолчанию не печатает эмодзи — переключаем вывод на UTF-8
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding='utf-8', errors='replace')
    except (AttributeError, ValueError):
        pass


def load_env(path):
    """Читает KEY=VALUE из файла .env (он не попадает в Git)."""
    if not os.path.exists(path):
        return
    with open(path, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            key, value = line.split('=', 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"\''))


load_env(os.path.join(BASE_DIR, '.env'))

# Логика заявки общая с Vercel-функцией: api/contact.py
_spec = importlib.util.spec_from_file_location('contact', os.path.join(BASE_DIR, 'api', 'contact.py'))
contact = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(contact)

HOST = os.environ.get('HOST', '127.0.0.1')
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get('PORT', 8000))
SITE_DIR = BASE_DIR

# отдаём наружу только файлы сайта — всё остальное (main.py, .env, api/ и т.д.) закрыто
ALLOWED_SUFFIXES = {
    '.html', '.css', '.js', '.png', '.jpg', '.jpeg', '.webp',
    '.gif', '.svg', '.ico', '.woff', '.woff2', '.txt', '.xml',
}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=SITE_DIR, **kwargs)

    def is_blocked(self):
        path = unquote(urlparse(self.path).path)
        if path.endswith('/'):
            path += 'index.html'
        # Windows не различает регистр и отбрасывает точки/пробелы в конце имени,
        # а через ':' можно обратиться к потоку файла (main.py::$DATA)
        if ':' in path or '\\' in path or '\x00' in path:
            return True
        parts = PurePosixPath(path).parts
        if any(part != part.rstrip(' .') or part.startswith('.') for part in parts[1:]):
            return True
        if len(parts) > 1 and parts[1].lower() == 'api':
            return True
        return PurePosixPath(path).suffix.lower() not in ALLOWED_SUFFIXES

    def list_directory(self, path):
        self.send_error(404)

    def do_GET(self):
        if self.is_blocked():
            return self.send_error(404)
        super().do_GET()

    def do_HEAD(self):
        if self.is_blocked():
            return self.send_error(404)
        super().do_HEAD()

    def do_POST(self):
        if urlparse(self.path).path != '/api/contact':
            return self.send_error(404)
        length = int(self.headers.get('Content-Length') or 0)
        if length > contact.MAX_BODY:
            return self.send_json(413, {'ok': False, 'error': 'Слишком большая заявка'})
        # за прокси (nginx и т. п.) задайте TRUST_PROXY=1 в .env, иначе IP берётся из соединения
        ip = self.client_address[0]
        if os.environ.get('TRUST_PROXY') == '1':
            ip = contact.client_ip_from_proxy(self.headers, ip)
        status, payload = contact.process(
            self.rfile.read(length),
            ip=ip,
            origin=self.headers.get('Origin', ''),
            host=self.headers.get('Host', ''),
        )
        self.send_json(status, payload)

    def send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == '__main__':
    if not contact.is_configured():
        print('⚠️  Не заданы TG_BOT_TOKEN и TG_CHAT_ID — заявки отправляться не будут.')
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f'Сайт запущен: http://localhost:{PORT}  (Ctrl+C — остановить)')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nСервер остановлен.')
