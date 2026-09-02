import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { UserData } from "../context/UserContext";
import { LoadingAnimation } from "../components/Loading";
import { motion } from 'framer-motion';
import { FaKey } from 'react-icons/fa';

const OtpVerify = () => {
  const [otp, setOtp] = useState("");
  const [formError, setFormError] = useState("");
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes in seconds
  const { verify, btnLoading } = UserData();
  const navigate = useNavigate();
  const { token } = useParams();
  const inputRef = useRef(null);

  // Timer countdown effect
  useEffect(() => {
    if (timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  // Format time as MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const submitHandler = (e) => {
    e.preventDefault();

    // Basic validation
    if (!otp.trim()) {
      setFormError("Please enter the verification code");
      return;
    }

    if (otp.length !== 6) {
      setFormError("Verification code must be 6 digits");
      return;
    }

    setFormError("");
    verify(token, otp, navigate);
  };

  const handleResendOtp = () => {
    // Logic for resending OTP would go here
    setTimeLeft(300); // Reset timer
    // You would need to call an API function here to resend the OTP
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

        <motion.h2 className='text-2xl font-bold text-white text-center mb-4' variants={itemVariants}>
          Verify OTP
        </motion.h2>

        <motion.p className='text-gray-300 text-sm text-center mb-6' variants={itemVariants}>
          Enter the 6-digit verification code sent to your email
        </motion.p>

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
                ref={inputRef}
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
                pattern="\d{6}"
              />
            </div>
          </motion.div>

          <motion.div className='mb-6 text-center' variants={itemVariants}>
            <p className={`text-sm ${timeLeft > 60 ? 'text-gray-400' : 'text-red-400'}`}>
              Code expires in {formatTime(timeLeft)}
            </p>
          </motion.div>

          <motion.button
            type='submit'
            className='w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#50c878] hover:bg-[#3daf63] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#50c878] transition-colors duration-200 flex items-center justify-center'
            disabled={btnLoading}
            variants={itemVariants}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {btnLoading ? <LoadingAnimation /> : "VERIFY CODE"}
          </motion.button>
        </form>

        <motion.div className='mt-6 text-center' variants={itemVariants}>
          <button
            onClick={handleResendOtp}
            disabled={timeLeft > 0}
            className={`text-sm font-medium ${timeLeft > 0 ? 'text-gray-500 cursor-not-allowed' : 'text-[#50c878] hover:underline cursor-pointer'}`}
          >
            {timeLeft > 0 ? "Resend code available after countdown" : "Didn't receive the code? Resend"}
          </button>

          <div className='mt-4 text-gray-300 text-sm'>
            <Link to="/login" className='font-medium text-[#50c878] hover:underline'>
              Return to login
            </Link>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default OtpVerify;