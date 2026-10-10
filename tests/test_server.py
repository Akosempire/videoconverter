import subprocess

import pytest

import server


@pytest.mark.parametrize("port", [None, "4321"])
def test_server_binds_public_interface_and_platform_port(monkeypatch, tmp_path, port):
    if port is None:
        monkeypatch.delenv("PORT", raising=False)
    else:
        monkeypatch.setenv("PORT", port)
    app = server.create_app({"TESTING": True, "UPLOAD_FOLDER": tmp_path})
    monkeypatch.setattr(server, "create_app", lambda: app)
    monkeypatch.setattr(server, "check_ffmpeg", lambda: None)
    calls = []
    monkeypatch.setattr(server, "serve", lambda app, **kwargs: calls.append(kwargs))
    server.main()
    assert calls[0]["host"] == "0.0.0.0"
    assert calls[0]["port"] == (4321 if port else 3000)
    assert calls[0]["max_request_body_size"] == 500 * 1024 * 1024
    assert app.test_client().get("/healthz").json == {"status": "ok"}


@pytest.mark.parametrize("port", ["abc", "0", "65536"])
def test_server_rejects_invalid_ports(monkeypatch, port):
    monkeypatch.setenv("PORT", port)
    with pytest.raises(ValueError, match="PORT must be"):
        server.main()


def test_server_does_not_accept_traffic_with_broken_ffmpeg(monkeypatch):
    monkeypatch.setenv("PORT", "3000")

    def unavailable(*args, **kwargs):
        raise FileNotFoundError("ffmpeg")

    monkeypatch.setattr(subprocess, "run", unavailable)
    served = []
    monkeypatch.setattr(server, "serve", lambda *a, **kw: served.append(True))
    with pytest.raises(RuntimeError, match="runtime image"):
        server.main()
    assert not served
