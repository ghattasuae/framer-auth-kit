import { Override } from "framer"
import { authStore } from "./authStore"

function createDisplayOverride(displayField: string): () => Override {
    return function (): Override {
        const { user } = authStore

        if (!user) {
            return { text: "" }
        }

        const fieldMap: Record<string, string> = {
            email: user.email ?? "",
            name: user.metadata?.full_name ?? user.email ?? "",
            role: user.role ?? "",
        }

        return {
            text: fieldMap[displayField] ?? "",
        }
    }
}

export const DisplayEmail = createDisplayOverride("email")
export const DisplayName = createDisplayOverride("name")
export const DisplayRole = createDisplayOverride("role")
