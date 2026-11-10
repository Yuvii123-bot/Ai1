import json
import threading
import unittest
from http.server import ThreadingHTTPServer
from types import SimpleNamespace
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from app.server import Handler


class ServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.url = 'http://127.0.0.1:%s' % cls.server.server_port

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def post(self, data):
        request = Request(self.url + '/api/chat', json.dumps(data).encode(), {'Content-Type': 'application/json'})
        try:
            result = urlopen(request)
        except HTTPError as exc:
            result = exc
        with result:
            return result.status, json.load(result)

    def test_home_and_config(self):
        with urlopen(self.url + '/') as response:
            self.assertIn(b'Your local AI starting point', response.read())
        with urlopen(self.url + '/api/config') as response:
            self.assertIn('model', json.load(response))

    @patch('app.server.ollama.Client')
    def test_chat_passes_history_to_ollama(self, client):
        client.return_value.chat.return_value = SimpleNamespace(message=SimpleNamespace(content='Hello!'))
        history = [{'role': 'user', 'content': 'Hi'}]
        status, body = self.post({'model': 'qwen2.5:0.5b', 'messages': history})
        self.assertEqual((status, body), (200, {'message': 'Hello!'}))
        client.return_value.chat.assert_called_once_with(model='qwen2.5:0.5b', messages=history)

    def test_rejects_invalid_message(self):
        status, body = self.post({'model': 'qwen2.5:0.5b', 'messages': [{'role': 'system', 'content': 'hello'}]})
        self.assertEqual(status, 400)
        self.assertIn('error', body)

    @patch('app.server.ollama.Client', side_effect=ConnectionError('offline'))
    def test_ollama_unavailable(self, client):
        status, body = self.post({'model': 'qwen2.5:0.5b', 'messages': [{'role': 'user', 'content': 'Hi'}]})
        self.assertEqual(status, 502)
        self.assertIn('Could not reach Ollama', body['error'])


if __name__ == '__main__':
    unittest.main()
