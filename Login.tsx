import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    // Mock login: store user in localStorage
    setTimeout(() => {
      localStorage.setItem(
        "herspace_user",
        JSON.stringify({ email, name: email.split("@")[0], loggedInAt: new Date().toISOString() })
      );
      setLoading(false);
      navigate("/circles");
    }, 800);
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-md">
          <Card className="bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-border/50">
            <CardHeader className="text-center space-y-2">
              <CardTitle className="text-2xl">Login</CardTitle>
              <CardDescription>Welcome back to HerSpace</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={onSubmit}>
                <div>
                  <label className="text-sm mb-1 block">Email</label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div>
                  <label className="text-sm mb-1 block">Password</label>
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <Button type="submit" variant="hero" className="w-full" disabled={loading}>
                  {loading ? "Signing in..." : "Login"}
                </Button>
              </form>
              <p className="text-sm text-muted-foreground mt-4 text-center">
                Don’t have an account? <Link to="/signup" className="text-primary">Sign Up</Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Login;
