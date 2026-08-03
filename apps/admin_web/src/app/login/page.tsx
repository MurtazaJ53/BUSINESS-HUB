import { AuthLogin } from "@/components/auth-login";

export const metadata = {
  title: "Sign In | Business Hub Cloud",
  description: "Sign in to access Business Hub POS terminal, inventory, and ledger",
};

export default function LoginPage() {
  return <AuthLogin />;
}
