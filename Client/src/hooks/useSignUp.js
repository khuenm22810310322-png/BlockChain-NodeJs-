import { authAPI } from "../services/api";
import { toast } from "react-toastify";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function useSignUp(username, password, confirmPassword) {
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const [captchaToken, setCaptchaToken] = useState(null);
	const navigate = useNavigate();

	const handleSubmit = async (e) => {
		e.preventDefault();
		setError("");

		if (password !== confirmPassword) {
			setError("Passwords do not match");
			return;
		}

		if (password.length < 8) {
			setError("Password length should be atleast 8");
			return;
		}

		if (!captchaToken) {
			setError("Please complete the CAPTCHA");
			return;
		}

		setLoading(true);

		try {
			await authAPI.register(username, password, captchaToken);
			toast.success(
				"User registered successfully, Please login to continue.",
				{
					position: "top-right",
					autoClose: 3000,
					hideProgressBar: false,
					closeOnClick: true,
					pauseOnHover: false,
					draggable: true,
				}
			);
			navigate("/login");
		} catch (err) {
			setError(err.response?.data?.Error || "Registration failed");
		} finally {
			setLoading(false);
		}
	};

	return {
		handleSubmit,
		loading,
		error,
		setCaptchaToken
	};
}
