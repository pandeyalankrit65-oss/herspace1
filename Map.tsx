import { MapPin, AlertTriangle, Shield, Info } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const Map = () => {
  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-6xl">
          {/* Header */}
          <div className="text-center mb-12 space-y-4">
            <h1 className="text-4xl md:text-5xl font-bold">
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Safe Zone Map
              </span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Community-mapped safe spaces and real-time safety insights for your area
            </p>
          </div>

          {/* Map Placeholder */}
          <Card className="mb-8 bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-border/50">
            <CardContent className="p-0">
              <div className="aspect-video bg-muted rounded-lg flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5" />
                <div className="relative z-10 text-center space-y-4 p-8">
                  <MapPin className="h-16 w-16 mx-auto text-primary" />
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Interactive Map Coming Soon</h3>
                    <p className="text-muted-foreground max-w-md mx-auto">
                      We're building an interactive map with Google Maps integration to show safe zones, emergency
                      facilities, and community-reported areas.
                    </p>
                  </div>
                  <Button variant="hero">Enable Location Access</Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Map Legend & Features */}
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <Card className="bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-border/50">
              <CardHeader>
                <Shield className="h-8 w-8 text-green-500 mb-2" />
                <CardTitle className="text-lg">Safe Zones</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Well-lit areas, police stations, hospitals, and community centers marked as safe spaces
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-border/50">
              <CardHeader>
                <AlertTriangle className="h-8 w-8 text-yellow-500 mb-2" />
                <CardTitle className="text-lg">Caution Areas</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Areas marked by the community as requiring extra vigilance during certain times
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-border/50">
              <CardHeader>
                <Info className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-lg">Emergency Services</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Quick access to nearby police stations, hospitals, and emergency response centers
                </CardDescription>
              </CardContent>
            </Card>
          </div>

          {/* Community Contributions */}
          <Card className="bg-gradient-to-br from-primary/10 to-accent/10 border-primary/30">
            <CardHeader>
              <CardTitle>Help Build a Safer Community</CardTitle>
              <CardDescription>
                Your local knowledge can help others stay safe. Mark areas and share safety tips.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Join our community effort to map safe and unsafe areas. Your contributions are anonymous and help
                create a comprehensive safety network.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button variant="hero" className="flex-1">Report Safe Zone</Button>
                <Button variant="glass" className="flex-1">Report Concern</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Map;
