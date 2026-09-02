import React, { useState, useEffect } from 'react'
import { UserData } from '../context/UserContext'
import { useNavigate, Link } from 'react-router-dom'
import { LoadingAnimation } from '../components/Loading'
import { motion } from 'framer-motion'
import { FaEnvelope, FaLock, FaEye, FaEyeSlash } from 'react-icons/fa'
import { FaGoogle } from "react-icons/fa";



const Login = () => {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [rememberMe, setRememberMe] = useState(false)
    const [formError, setFormError] = useState("")

    const { loginUser, btnLoading } = UserData()
    const navigate = useNavigate()


    // Check if there's saved email in localStorage
    useEffect(() => {
        const savedEmail = localStorage.getItem('DMS_email')
        if (savedEmail) {
            setEmail(savedEmail)
            setRememberMe(true)
        }
    }, [])

    const submitHandler = (e) => {
        e.preventDefault()

        // Simple validation
        if (!email.trim() || !password.trim()) {
            setFormError("Please fill in all fields")
            return
        }

        // Save email if remember me is checked
        if (rememberMe) {
            localStorage.setItem('DMS_email', email)
        } else {
            localStorage.removeItem('DMS_email')
        }

        setFormError("")
        loginUser(email, password, navigate)
    }

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
    }

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: { y: 0, opacity: 1 }
    }

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
                    Welcome Back
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

                    <motion.div className='mb-6' variants={itemVariants}>
                        <label htmlFor="password" className='block text-sm font-medium text-gray-300 mb-1'>
                            PASSWORD
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
                                placeholder='Enter your password'
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
                    </motion.div>

                    <motion.div className='flex items-center justify-between mb-6' variants={itemVariants}>
                        <div className='flex items-center'>
                            <input
                                type="checkbox"
                                id="remember"
                                className='h-4 w-4 text-[#50c878] focus:ring-[#50c878] border-gray-300 rounded'
                                checked={rememberMe}
                                onChange={() => setRememberMe(!rememberMe)}
                            />
                            <label htmlFor="remember" className='ml-2 block text-sm text-gray-300'>
                                Remember me
                            </label>
                        </div>
                        <div>
                            <Link to="/forgot" className='text-sm font-medium text-[#50c878] hover:underline'>
                                Forgot password?
                            </Link>
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
                        {btnLoading ? <LoadingAnimation /> : "SIGN IN"}
                    </motion.button>
                </form>

                <motion.div className='mt-6 text-center' variants={itemVariants}>
                    <div className='relative mb-4'>
                        <div className='absolute inset-0 flex items-center'>
                            <div className='w-full border-t border-gray-700'></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className='px-2 bg-[#1A1A1D] text-gray-400'>or</span>
                        </div>
                    </div>


                    <div className='text-gray-300'>
                        Don't have an account?{' '}
                        <Link to="/register" className='font-medium text-[#50c878] hover:underline'>
                            Create an account
                        </Link>
                    </div>
                </motion.div>
            </motion.div>

        </div>
    )
}

export default Login