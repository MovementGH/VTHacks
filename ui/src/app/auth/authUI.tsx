"use client"
import { withAuthInfo, useRedirectFunctions, WithAuthInfoProps } from '@propelauth/react'
import { redirect } from 'next/navigation';

const AuthUI = withAuthInfo((props: WithAuthInfoProps) => {
    const { redirectToOrgPage, redirectToLoginPage, redirectToSignupPage, redirectToAccountPage } = useRedirectFunctions();

    if (!props.isLoggedIn) {
        return (
                <div className="bg-foreground p-8 rounded-lg shadow-lg text-center w-96">
                    <div className="mb-6 p-4 rounded-md">
                        <h2 className="text-xl font-semibold text-orange-500">Hello!</h2>
                        <p className="text-gray-600 mt-2">Login with <span className=" font-semibold text-green-800">PropelAuth</span></p>
                    </div>
                    <button
                        className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition-colors w-full mb-2"
                        onClick={() => redirectToLoginPage()}
                    >
                        Login
                    </button>
                    <button
                        className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 transition-colors w-full"
                        onClick={() => redirectToSignupPage()}
                    >
                        Signup
                    </button>
                </div>
        );
    }
    else {
        redirect("/home")
    }
});

export default AuthUI