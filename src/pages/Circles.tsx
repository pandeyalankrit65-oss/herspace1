import { Users, Lock, Building2, GraduationCap, Heart, MessageSquare } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const Circles = () => {
  const circles = [
    {
      name: "Tech Industry Women",
      category: "Corporate",
      icon: Building2,
      description: "Connect with women in technology, share experiences, and support each other's career growth.",
    },
    {
      name: "University Campus Safe Network",
      category: "College",
      icon: GraduationCap,
      description: "A student community for campus safety, event coordination, and peer support.",
    },
    {
      name: "Healthcare Professionals",
      category: "Corporate",
      icon: Heart,
      description: "A supportive space for women in healthcare to share challenges and resources.",
    },
    {
      name: "Local Community Network",
      category: "Community",
      icon: Users,
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
              Private communities where women connect, share experiences, and support each other
            </p>
          </div>

          {/* Authentication Notice */}
          <Card className="mb-8 bg-gradient-to-br from-primary/10 to-accent/10 border-primary/30">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-primary" />
                <CardTitle>Coming soon</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Safe Circles aren't open yet. Below is a preview of the kinds of communities we're planning. Joining,
                member verification and moderated discussions will arrive in a future release.
              </p>
            </CardContent>
          </Card>

          {/* Circles Grid */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-6">Planned Circles</h2>
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
                    </div>
                    <CardTitle className="mt-4">{circle.name}</CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      <Badge variant="outline">{circle.category}</Badge>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">{circle.description}</p>
                    <Button variant="hero" className="w-full" disabled>
                      Coming soon
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
                  Circles will be private and invite-only, so members know who they're talking to.
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
                  Planned: share experiences, seek advice, and offer support in moderated spaces.
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
                We'd like to hear from workplaces, colleges and neighbourhood groups interested in running one.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <a href="/about">
                <Button variant="hero" size="lg">Learn more about HerSpace</Button>
              </a>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Circles;
