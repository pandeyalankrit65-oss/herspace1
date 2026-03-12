import { Users, Lock, Building2, GraduationCap, Heart, MessageSquare } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";

const Circles = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const circles = [
    {
      name: "Tech Industry Women",
      category: "Corporate",
      icon: Building2,
      members: 1247,
      verified: true,
      description: "Connect with women in technology, share experiences, and support each other's career growth.",
    },
    {
      name: "University Campus Safe Network",
      category: "College",
      icon: GraduationCap,
      members: 856,
      verified: true,
      description: "Student-verified community for campus safety, event coordination, and peer support.",
    },
    {
      name: "Healthcare Professionals",
      category: "Corporate",
      icon: Heart,
      members: 634,
      verified: true,
      description: "A supportive space for women in healthcare to share challenges and resources.",
    },
    {
      name: "Local Community Network",
      category: "Community",
      icon: Users,
      members: 2103,
      verified: false,
      description: "Connect with neighbors, organize safety patrols, and build community resilience.",
    },
  ];

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-6xl">
          {/* Header */}
          <div className="text-center mb-12 space-y-4">
            <h1 className="text-4xl md:text-5xl font-bold">
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Safe Circles
              </span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Join verified communities where women connect, share experiences, and support each other in safe,
              moderated spaces
            </p>
          </div>

          {/* Authentication Notice */}
          <Card className="mb-8 bg-gradient-to-br from-primary/10 to-accent/10 border-primary/30">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-primary" />
                <CardTitle>Secure & Verified Communities</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                To ensure safety and privacy, Safe Circles require verification. Login or create an account to access
                these communities.
              </p>
              <div className="flex gap-4">
                <a href="/login">
                  <Button variant="hero" size="lg">Login / Sign Up</Button>
                </a>
                <a href="/about">
                  <Button variant="glass" size="lg">Learn More</Button>
                </a>
              </div>
            </CardContent>
          </Card>

          {/* Circles Grid */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-6">Available Circles</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {circles.map((circle, index) => (
                <Card
                  key={index}
                  className="group bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-border/50 hover:border-primary/50 transition-all hover:shadow-[var(--glow-primary)]"
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="p-3 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 group-hover:shadow-[var(--glow-primary)] transition-all">
                        <circle.icon className="h-6 w-6 text-primary" />
                      </div>
                      {circle.verified && (
                        <Badge variant="secondary" className="bg-green-500/20 text-green-400 border-green-500/50">
                          <Lock className="h-3 w-3 mr-1" />
                          Verified
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="mt-4">{circle.name}</CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      <Badge variant="outline">{circle.category}</Badge>
                      <span className="text-xs">
                        <Users className="h-3 w-3 inline mr-1" />
                        {circle.members.toLocaleString()} members
                      </span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">{circle.description}</p>
                    <Button
                      variant="hero"
                      className="w-full"
                      onClick={() => {
                        const raw = localStorage.getItem("herspace_user");
                        if (!raw) {
                          navigate("/login");
                          return;
                        }
                        toast({ title: "Request sent", description: `You requested to join “${circle.name}”.` });
                      }}
                    >
                      Join Circle
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <Card className="bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-border/50">
              <CardHeader>
                <Lock className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-lg">Private & Secure</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  All circles are private and require verification. Your data and conversations are encrypted.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-border/50">
              <CardHeader>
                <MessageSquare className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-lg">Moderated Discussions</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Share experiences, seek advice, and offer support in actively moderated safe spaces.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-border/50">
              <CardHeader>
                <Users className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-lg">Build Connections</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Connect with women who share similar experiences, challenges, and aspirations.
                </CardDescription>
              </CardContent>
            </Card>
          </div>

          {/* Create Circle CTA */}
          <Card className="bg-gradient-to-br from-primary/10 to-accent/10 border-primary/30">
            <CardHeader>
              <CardTitle>Want to Create a Circle?</CardTitle>
              <CardDescription>
                Start your own verified community for your workplace, college, or neighborhood
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="hero"
                size="lg"
                onClick={() => {
                  const raw = localStorage.getItem("herspace_user");
                  if (!raw) {
                    navigate("/login");
                    return;
                  }
                  toast({ title: "Application started", description: "We'll guide you through creating a verified circle." });
                }}
              >
                Apply to Create Circle
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Circles;
