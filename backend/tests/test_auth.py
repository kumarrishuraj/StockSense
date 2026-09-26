from conftest import signup


def test_signup_returns_token_and_user(client):
    body = signup(client, email="New.User@Test.io")
    assert body["token_type"] == "bearer"
    assert body["access_token"]
    assert body["user"]["email"] == "new.user@test.io"  # stored lower-case
    assert body["user"]["role"] == "manager"
    assert "password" not in str(body["user"]).lower()


def test_signup_rejects_duplicate_email(client):
    signup(client)
    response = client.post("/auth/signup", json={"name": "Again", "email": "MANAGER@test.io", "password": "Secret123"})
    assert response.status_code == 409
    assert "already exists" in response.json()["detail"]


def test_signup_rejects_weak_password_with_readable_message(client):
    response = client.post("/auth/signup", json={"name": "Weak", "email": "weak@test.io", "password": "short"})
    assert response.status_code == 422
    assert response.json()["detail"] == "Password: Password must be at least 8 characters"

    response = client.post("/auth/signup", json={"name": "Weak", "email": "weak@test.io", "password": "lettersonly"})
    assert "at least one letter and one number" in response.json()["detail"]


def test_login_and_me(client):
    signup(client)
    response = client.post("/auth/login", json={"email": "manager@test.io", "password": "Secret123"})
    assert response.status_code == 200
    token = response.json()["access_token"]

    me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["name"] == "Test Manager"


def test_login_with_wrong_password_or_unknown_email(client):
    signup(client)
    for email, password in (("manager@test.io", "Wrong1234"), ("nobody@test.io", "Secret123")):
        response = client.post("/auth/login", json={"email": email, "password": password})
        assert response.status_code == 401
        assert response.json()["detail"] == "Invalid email or password."


def test_protected_routes_require_a_valid_token(client):
    assert client.get("/products").status_code == 401
    response = client.get("/products", headers={"Authorization": "Bearer not-a-real-token"})
    assert response.status_code == 401
    assert "session has expired" in response.json()["detail"]


def test_update_profile_name(client):
    token = signup(client)["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    response = client.put("/auth/me", json={"name": "  Renamed User "}, headers=headers)
    assert response.status_code == 200
    assert response.json()["name"] == "Renamed User"


def test_forgot_password_otp_and_reset_flow(client):
    old_token = signup(client)["access_token"]

    forgot = client.post("/auth/forgot-password", json={"email": "manager@test.io"})
    assert forgot.status_code == 200
    body = forgot.json()
    assert body["dev_mode"] is True
    otp = body["dev_otp"]
    assert len(otp) == 6 and otp.isdigit()

    wrong = "000000" if otp != "000000" else "111111"
    response = client.post("/auth/verify-otp", json={"email": "manager@test.io", "otp": wrong})
    assert response.status_code == 400
    assert "4 attempts left" in response.json()["detail"]

    verified = client.post("/auth/verify-otp", json={"email": "manager@test.io", "otp": otp})
    assert verified.status_code == 200
    reset_token = verified.json()["reset_token"]

    reset = client.post("/auth/reset-password", json={"reset_token": reset_token, "new_password": "BrandNew99"})
    assert reset.status_code == 200

    # New password works, the old one doesn't, and sessions from before the reset are revoked.
    assert client.post("/auth/login", json={"email": "manager@test.io", "password": "BrandNew99"}).status_code == 200
    assert client.post("/auth/login", json={"email": "manager@test.io", "password": "Secret123"}).status_code == 401
    assert client.get("/auth/me", headers={"Authorization": f"Bearer {old_token}"}).status_code == 401

    # The reset token and OTP are single-use.
    again = client.post("/auth/reset-password", json={"reset_token": reset_token, "new_password": "Another123"})
    assert again.status_code == 400
    assert client.post("/auth/verify-otp", json={"email": "manager@test.io", "otp": otp}).status_code == 400


def test_forgot_password_for_unknown_email_reveals_nothing(client):
    response = client.post("/auth/forgot-password", json={"email": "ghost@test.io"})
    assert response.status_code == 200
    assert response.json()["dev_otp"] is None
    assert "If an account exists" in response.json()["message"]


def test_otp_is_locked_after_too_many_wrong_attempts(client):
    signup(client)
    otp = client.post("/auth/forgot-password", json={"email": "manager@test.io"}).json()["dev_otp"]
    wrong = "000000" if otp != "000000" else "111111"
    for _ in range(5):
        client.post("/auth/verify-otp", json={"email": "manager@test.io", "otp": wrong})
    response = client.post("/auth/verify-otp", json={"email": "manager@test.io", "otp": otp})
    assert response.status_code == 400
    assert "Too many incorrect attempts" in response.json()["detail"]


def test_requesting_a_new_otp_invalidates_the_previous_one(client):
    signup(client)
    first = client.post("/auth/forgot-password", json={"email": "manager@test.io"}).json()["dev_otp"]
    second = client.post("/auth/forgot-password", json={"email": "manager@test.io"}).json()["dev_otp"]
    if first != second:
        assert client.post("/auth/verify-otp", json={"email": "manager@test.io", "otp": first}).status_code == 400
    assert client.post("/auth/verify-otp", json={"email": "manager@test.io", "otp": second}).status_code == 200


def test_change_password_returns_a_fresh_token(client):
    token = signup(client)["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    bad = client.post("/auth/change-password", json={"current_password": "nope", "new_password": "Changed123"}, headers=headers)
    assert bad.status_code == 400

    response = client.post(
        "/auth/change-password", json={"current_password": "Secret123", "new_password": "Changed123"}, headers=headers
    )
    assert response.status_code == 200
    new_headers = {"Authorization": f"Bearer {response.json()['access_token']}"}
    assert client.get("/auth/me", headers=new_headers).status_code == 200
    assert client.post("/auth/login", json={"email": "manager@test.io", "password": "Changed123"}).status_code == 200
