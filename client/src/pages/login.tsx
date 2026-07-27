import { useState } from "react";
import { useAuth } from "../hooks/use-auth";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { toast } from "sonner";

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login.mutateAsync({ email, password });
    } catch (err: any) {
      toast.error(err.message ?? "Login failed");
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f7f7] flex items-center justify-center">
      <div className="bg-white border border-[#e5e5e5] rounded-lg p-8 w-full max-w-sm shadow-sm">
        <div className="mb-7">
          <h1 className="text-xl font-bold text-[#0a0a0a] tracking-tight">Distillr</h1>
          <p className="text-xs text-[#737373] mt-1">Distillery operations and compliance</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-[#0a0a0a] mb-1">Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@distillery.com"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#0a0a0a] mb-1">Password</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          <Button type="submit" className="w-full mt-1" disabled={login.isPending}>
            {login.isPending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
