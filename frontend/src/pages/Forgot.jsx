import React, { useState } from 'react';
import { UserData } from '../context/UserContext';
import { useNavigate, Link } from 'react-router-dom';
import { LoadingAnimation } from '../components/Loading';
import { motion } from 'framer-motion';
import { FaEnvelope } from 'react-icons/fa';

const Forgot = () => {
  const [email, setEmail] = useState("");
  const [formError, setFormError] = useState("");
  const { btnLoading, forgotUser } = UserData();
  const navigate = useNavigate();

  const submitHandler = (e) => {
    e.preventDefault();

    // Simple validation
    if (!email.trim()) {
      setFormError("Please enter your email address");
      return;
    }

    setFormError("");
    forgotUser(email, navigate);
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
          Forgot Password
        </motion.h2>

        <motion.p className='text-gray-300 text-sm text-center mb-6' variants={itemVariants}>
          Enter your email address
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
          <motion.div className='mb-6' variants={itemVariants}>
            <label htmlFor="email" className='block text-sm font-medium text-gray-300 mb-1'>
              EMAIL
            </label>
            <div className='relative'>
              <div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'>
                <FaEnvelope className='text-gray-500' />
              </div>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                type="email"
                id='email'
                className='w-full py-2 pl-10 pr-3 border border-gray-700 bg-gray-900 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-[#50c878] focus:border-transparent'
                placeholder='Enter your email'
              />
            </div>
          </motion.div>

          <motion.button
            type='submit'
            className='w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#50c878] hover:bg-[#3daf63] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#50c878] transition-colors duration-200 flex items-center justify-center'
            disabled={btnLoading}
            variants={itemVariants}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {btnLoading ? <LoadingAnimation /> : "SEND RESET LINK"}
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

export default Forgot;