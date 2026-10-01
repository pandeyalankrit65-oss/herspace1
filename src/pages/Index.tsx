import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Dashboard from "@/components/home/Dashboard";
import Landing from "@/components/home/Landing";
import { useAuth } from "@/contexts/AuthContext";
import { offlineUser } from "@/lib/offline";

const Index = () => {
  const { user, loading } = useAuth();
  // While the session is being checked, someone who was signed in last time sees an empty
  // frame rather than a flash of the public landing page.
  if (loading && offlineUser.get()) {
    return (
      <div className="min-h-screen">
        <Navbar />
      </div>
    );
  }
  if (user) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <Dashboard />
        <Footer />
      </div>
    );
  }
  return <Landing />;
};

export default Index;
