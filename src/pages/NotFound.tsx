import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";

const NotFound = () => (
  <div className="min-h-screen">
    <Navbar />
    <main className="pt-32 pb-16 px-4">
      <div className="container mx-auto max-w-md text-center space-y-4">
        <h1 className="text-5xl font-bold">404</h1>
        <p className="text-lg text-muted-foreground">This page doesn't exist.</p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Link to="/">
            <Button variant="hero" className="w-full">Go to home</Button>
          </Link>
          <Link to="/sos">
            <Button variant="emergency" className="w-full">Emergency SOS</Button>
          </Link>
        </div>
      </div>
    </main>
  </div>
);

export default NotFound;
