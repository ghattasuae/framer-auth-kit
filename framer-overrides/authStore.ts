import { Override, Data } from "framer"
import { useEffect } from "react"

const BACKEND_URL = "YOUR_BACKEND_URL"

interface UserObject {
    id: string
    email: string
    name: string
    role: string
}

interface AuthState {
    user: UserObject | null
    isLoggedIn: boolean
    isLoading: boolean
}

export const authStore = Data<AuthState>({
    user: null,
    isLoggedIn: false,
    isLoading: true,
})

export async function checkSession(): Promise<void> {
    authStore.isLoading = true
    try {
        const response = await fetch(`${BACKEND_URL}/auth/session`, {
            method: "GET",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
        })
        if (response.ok) {
            const data = await response.json()
            authStore.user = data.user
            authStore.isLoggedIn = data.user !== null
        } else {
            authStore.user = null
            authStore.isLoggedIn = false
        }
    } catch {
        authStore.user = null
        authStore.isLoggedIn = false
    } finally {
        authStore.isLoading = false
    }
}

export function AuthProvider(): Override {
    useEffect(() => {
        checkSession()
    }, [])

    return {}
}
