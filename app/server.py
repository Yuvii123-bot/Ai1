"""A small local web interface backed by the vendored Ollama Python client."""
import argparse
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import ollama

ROOT = Path(__file__).resolve().parent
MAX_BODY = 1024 * 1024
DEFAULT_MODEL = os.environ.get('AI1_MODEL', 'qwen2.5:0.5b')


class Handler(BaseHTTPRequestHandler):
    def respond(self, status, body, content_type='application/json; charset=utf-8'):
        if isinstance(body, dict):
            body = json.dumps(body).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == '/':
            self.respond(200, (ROOT / 'index.html').read_bytes(), 'text/html; charset=utf-8')
        elif self.path == '/api/config':
            self.respond(200, {'model': DEFAULT_MODEL})
        else:
            self.respond(404, {'error': 'Not found'})

    def do_POST(self):
        if self.path != '/api/chat':
            return self.respond(404, {'error': 'Not found'})
        if self.headers.get_content_type() != 'application/json':
            return self.respond(415, {'error': 'Expected application/json'})
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if length <= 0 or length > MAX_BODY:
                raise ValueError('Request must be between 1 byte and 1 MB')
            data = json.loads(self.rfile.read(length))
            model, messages = data['model'], data['messages']
            if not isinstance(model, str) or not model.strip() or len(model) > 200:
                raise ValueError('Please provide a valid model name')
            if not isinstance(messages, list) or not messages or len(messages) > 200:
                raise ValueError('Please provide 1–200 messages')
            if any(not isinstance(m, dict) or m.get('role') not in ('user', 'assistant')
                   or not isinstance(m.get('content'), str) or not m['content'].strip()
                   for m in messages):
                raise ValueError('Invalid conversation')
            clean_messages = [{'role': m['role'], 'content': m['content']} for m in messages]
        except (ValueError, KeyError, TypeError, json.JSONDecodeError) as exc:
            return self.respond(400, {'error': str(exc) or 'Invalid request'})
        try:
            client = ollama.Client(host=os.environ.get('OLLAMA_HOST', 'http://127.0.0.1:11434'), timeout=300)
            response = client.chat(model=model.strip(), messages=clean_messages)
            answer = response.message.content
            if not answer:
                return self.respond(502, {'error': 'The model returned an empty response. Try another model.'})
            self.respond(200, {'message': answer})
        except ollama.ResponseError as exc:
            self.respond(502, {'error': f'Ollama: {exc.error}'})
        except Exception:
            self.respond(502, {'error': 'Could not reach Ollama. Make sure it is running and the model is installed.'})


def main():
    parser = argparse.ArgumentParser(description='Run the Ai1 local chat server')
    parser.add_argument('--host', default='127.0.0.1', help='Interface to bind (default: 127.0.0.1)')
    parser.add_argument('--port', type=int, default=8000)
    args = parser.parse_args()
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f'Ai1 listening on http://{args.host}:{args.port}', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
