import { Override } from "framer"
import { useEffect } from "react"
import { authStore } from "./authStore"

const DASHBOARD_PATH = "/dashboard"

export function authRedirect(): Override {
    const { isLoggedIn, isLoading } = authStore

    useEffect(() => {
        if (isLoggedIn && !isLoading) {
            window.location.href = DASHBOARD_PATH
        }
    }, [isLoggedIn, isLoading])

    return {}
}
