import unittest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import Base, engine, SessionLocal
from app.api.v1.endpoints.auth import seed_demo_users_if_empty


class TestDoubleVerificationAuth(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)
        seed_demo_users_if_empty()
        cls.client = TestClient(app)

    def test_invalid_login_credentials(self):
        res = self.client.post("/api/v1/auth/login", json={
            "username_or_email": "admin",
            "password": "WrongPassword123"
        })
        self.assertEqual(res.status_code, 401)
        self.assertIn("Invalid credentials", res.json()["detail"])

    def test_double_verification_login_flow(self):
        # Step 1: Login with valid credentials
        res1 = self.client.post("/api/v1/auth/login", json={
            "username_or_email": "admin@cyberrisk.soc",
            "password": "AdminPassword@2026"
        })
        self.assertEqual(res1.status_code, 200)
        body1 = res1.json()
        self.assertTrue(body1["requires_2fa"])
        self.assertIn("temp_token", body1)
        self.assertIn("preview_otp", body1)
        temp_token = body1["temp_token"]
        otp = body1["preview_otp"]

        # Step 2 with incorrect OTP
        res2_bad = self.client.post("/api/v1/auth/verify-2fa", json={
            "temp_token": temp_token,
            "otp_code": "999999"
        })
        self.assertEqual(res2_bad.status_code, 400)
        self.assertIn("Incorrect security code", res2_bad.json()["detail"])

        # Step 2 with valid OTP
        res2_good = self.client.post("/api/v1/auth/verify-2fa", json={
            "temp_token": temp_token,
            "otp_code": otp
        })
        self.assertEqual(res2_good.status_code, 200)
        body2 = res2_good.json()
        self.assertIn("access_token", body2)
        token = body2["access_token"]
        self.assertEqual(body2["user"]["username"], "admin")

        # Step 3: Access /me with token
        res_me = self.client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(res_me.status_code, 200)
        self.assertEqual(res_me.json()["email"], "admin@cyberrisk.soc")

        # Step 4: Logout
        res_logout = self.client.post("/api/v1/auth/logout", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(res_logout.status_code, 200)

        # Step 5: After logout, /me is unauthorized
        res_after = self.client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(res_after.status_code, 401)

    def test_resend_otp(self):
        # Initiate login
        res1 = self.client.post("/api/v1/auth/login", json={
            "username_or_email": "analyst",
            "password": "AnalystPassword@2026"
        })
        self.assertEqual(res1.status_code, 200)
        temp_token = res1.json()["temp_token"]

        # Resend code
        res_resend = self.client.post("/api/v1/auth/resend-2fa", json={"temp_token": temp_token})
        self.assertEqual(res_resend.status_code, 200)
        new_otp = res_resend.json()["preview_otp"]
        self.assertTrue(len(new_otp) == 6)

        # Verify with new OTP
        res_verify = self.client.post("/api/v1/auth/verify-2fa", json={
            "temp_token": temp_token,
            "otp_code": new_otp
        })
        self.assertEqual(res_verify.status_code, 200)
        self.assertEqual(res_verify.json()["user"]["username"], "analyst")


if __name__ == "__main__":
    unittest.main()
