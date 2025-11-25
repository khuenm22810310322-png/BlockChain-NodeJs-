import { useAuth } from "../context/AuthContext";
import { authAPI } from "../services/api";
import { toast } from "react-toastify";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function useLogin(username, password, onSuccess) {
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const [captchaToken, setCaptchaToken] = useState(null);
	const { login } = useAuth();
	const navigate = useNavigate();

	const handleSubmit = async (e) => {
		e.preventDefault();
		setLoading(true);
		setError("");

		if (!captchaToken) {
			setError("Please complete the CAPTCHA");
			setLoading(false);
			return;
		}

		try {
			const response = await authAPI.login(username, password, captchaToken);
			login(response.token, response.user);
			toast.success("Login successful, Welcome back!", {
				position: "top-right",
				autoClose: 3000,
				hideProgressBar: false,
				closeOnClick: true,
				pauseOnHover: false,
				draggable: true,
			});
			if (typeof onSuccess === "function") {
				onSuccess();
			}
			navigate("/dashboard");
		} catch (err) {
			setError(err.response?.data?.error || "Login failed");
		} finally {
			setLoading(false);
		}
	};

	return { handleSubmit, loading, error, setCaptchaToken };
}
