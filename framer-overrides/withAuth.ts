import { Override } from "framer"
import { useEffect } from "react"
import { authStore } from "./authStore"

const LOGIN_PATH = "/login"

export function withAuth(): Override {
    const { isLoggedIn, isLoading } = authStore

    useEffect(() => {
        if (!isLoggedIn && !isLoading) {
            window.location.href = LOGIN_PATH
        }
    }, [isLoggedIn, isLoading])

    return {
        style: {
            opacity: isLoading ? 0 : 1,
            transition: "opacity 0.2s ease",
        },
    }
}
