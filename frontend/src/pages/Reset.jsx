import React, { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { UserData } from "../context/UserContext";
import { LoadingAnimation } from "../components/Loading";
import { motion } from 'framer-motion';
import { FaKey, FaLock, FaEye, FaEyeSlash } from 'react-icons/fa';

const Reset = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formError, setFormError] = useState("");
  const { resetUser, btnLoading } = UserData();
  const navigate = useNavigate();
  const { token } = useParams();

  // Password strength checker
  const checkPasswordStrength = (password) => {
    let strength = 0;
    const regex = {
      length: password.length >= 8,
      hasUpperCase: /[A-Z]/.test(password),
      hasLowerCase: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecial: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)
    };

    // Count how many criteria are met
    Object.values(regex).forEach(met => {
      if (met) strength++;
    });

    if (strength <= 2) return "weak";
    if (strength <= 4) return "medium";
    return "strong";
  };

  const getPasswordStrengthColor = (password) => {
    const strength = checkPasswordStrength(password);
    if (strength === "weak") return "bg-red-500";
    if (strength === "medium") return "bg-yellow-500";
    return "bg-green-500";
  };

  const getPasswordStrengthText = (password) => {
    if (!password) return "";
    const strength = checkPasswordStrength(password);
    if (strength === "weak") return "Weak";
    if (strength === "medium") return "Medium";
    return "Strong";
  };

  const submitHandler = (e) => {
    e.preventDefault();

    // Validation
    if (!otp.trim() || !password.trim() || !confirmPassword.trim()) {
      setFormError("All fields are required");
      return;
    }

    if (otp.length !== 6) {
      setFormError("OTP must be 6 digits");
      return;
    }

    if (password.length < 8) {
      setFormError("Password must be at least 8 characters long");
      return;
    }

    if (password !== confirmPassword) {
      setFormError("Passwords do not match");
      return;
    }

    setFormError("");
    resetUser(token, otp, password, navigate);
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.5,
        when: "beforeChildren",
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  return (
    <div className='min-h-screen flex items-center justify-center bg-gradient-to-b from-black to-gray-900'>
      <motion.div
        className='p-8 rounded-lg shadow-lg w-full max-w-md backdrop-blur-sm bg-opacity-80 bg-[#1A1A1D] border border-gray-800'
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        <motion.h2 className='text-xl font-semibold text-center mb-2 text-[#50c878]' variants={itemVariants}>
          DMS
        </motion.h2>

        <motion.h2 className='text-2xl font-bold text-white text-center mb-6' variants={itemVariants}>
          Reset Password
        </motion.h2>

        {formError && (
          <motion.div
            className='mb-4 p-3 bg-red-500 bg-opacity-20 border border-red-500 rounded text-red-300 text-sm'
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {formError}
          </motion.div>
        )}

        <form onSubmit={submitHandler}>
          <motion.div className='mb-4' variants={itemVariants}>
            <label htmlFor="otp" className='block text-sm font-medium text-gray-300 mb-1'>
              VERIFICATION CODE
            </label>
            <div className='relative'>
              <div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'>
                <FaKey className='text-gray-500' />
              </div>
              <input
                value={otp}
                onChange={(e) => {
                  // Only allow digits
                  const value = e.target.value.replace(/\D/g, '');
                  if (value.length <= 6) {
                    setOtp(value);
                  }
                }}
                required
                type="text"
                id='otp'
                className='w-full py-2 pl-10 pr-3 border border-gray-700 bg-gray-900 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-[#50c878] focus:border-transparent tracking-widest text-center font-mono'
                placeholder='Enter 6-digit code'
                maxLength={6}
              />
            </div>
          </motion.div>

          <motion.div className='mb-4' variants={itemVariants}>
            <label htmlFor="password" className='block text-sm font-medium text-gray-300 mb-1'>
              NEW PASSWORD
            </label>
            <div className='relative'>
              <div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'>
                <FaLock className='text-gray-500' />
              </div>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                type={showPassword ? "text" : "password"}
                id='password'
                className='w-full py-2 pl-10 pr-10 border border-gray-700 bg-gray-900 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-[#50c878] focus:border-transparent'
                placeholder='Create new password'
                minLength={8}
              />
              <div
                className='absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer'
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ?
                  <FaEyeSlash className='text-gray-500 hover:text-gray-300' /> :
                  <FaEye className='text-gray-500 hover:text-gray-300' />
                }
              </div>
            </div>

            {password && (
              <div className='mt-2'>
                <div className='flex items-center justify-between mb-1'>
                  <span className='text-xs text-gray-400'>Password strength:</span>
                  <span className='text-xs font-medium' style={{ color: getPasswordStrengthColor(password).replace('bg-', 'text-') }}>
                    {getPasswordStrengthText(password)}
                  </span>
                </div>
                <div className='w-full h-1 bg-gray-700 rounded-full overflow-hidden'>
                  <motion.div
                    className={`h-full ${getPasswordStrengthColor(password)}`}
                    initial={{ width: 0 }}
                    animate={{
                      width: password ?
                        (checkPasswordStrength(password) === "weak" ? "33%" :
                          checkPasswordStrength(password) === "medium" ? "66%" : "100%")
                        : "0%"
                    }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                <div className='mt-1 text-xs text-gray-400'>
                  Use at least 8 characters with uppercase, lowercase, numbers, and special characters.
                </div>
              </div>
            )}
          </motion.div>

          <motion.div className='mb-6' variants={itemVariants}>
            <label htmlFor="confirmPassword" className='block text-sm font-medium text-gray-300 mb-1'>
              CONFIRM PASSWORD
            </label>
            <div className='relative'>
              <div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'>
                <FaLock className='text-gray-500' />
              </div>
              <input
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                type={showConfirmPassword ? "text" : "password"}
                id='confirmPassword'
                className='w-full py-2 pl-10 pr-10 border border-gray-700 bg-gray-900 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-[#50c878] focus:border-transparent'
                placeholder='Confirm new password'
              />
              <div
                className='absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer'
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ?
                  <FaEyeSlash className='text-gray-500 hover:text-gray-300' /> :
                  <FaEye className='text-gray-500 hover:text-gray-300' />
                }
              </div>
            </div>
            {password && confirmPassword && (
              <div className='mt-1 text-xs text-right'>
                {password === confirmPassword ?
                  <span className='text-green-400'>Passwords match</span> :
                  <span className='text-red-400'>Passwords don't match</span>
                }
              </div>
            )}
          </motion.div>

          <motion.button
            type='submit'
            className='w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#50c878] hover:bg-[#3daf63] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#50c878] transition-colors duration-200 flex items-center justify-center'
            disabled={btnLoading}
            variants={itemVariants}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {btnLoading ? <LoadingAnimation /> : "RESET PASSWORD"}
          </motion.button>
        </form>

        <motion.div className='mt-6 text-center' variants={itemVariants}>
          <div className='text-gray-300'>
            Remember your password?{' '}
            <Link to="/login" className='font-medium text-[#50c878] hover:underline'>
              Sign in
            </Link>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Reset;