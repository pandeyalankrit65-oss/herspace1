import { Shield, Heart, Users, Target, Eye, Lightbulb } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const About = () => {
  const values = [
    {
      icon: Shield,
      title: "Safety First",
      description: "Providing tools and resources that prioritize women's physical and emotional safety in every situation.",
    },
    {
      icon: Heart,
      title: "Empathy & Support",
      description: "Creating compassionate spaces where every voice is heard and every experience is validated.",
    },
    {
      icon: Users,
      title: "Community Power",
      description: "Building strength through connection, shared experiences, and collective action.",
    },
    {
      icon: Lightbulb,
      title: "Innovation",
      description: "Leveraging technology to create accessible, effective safety and support solutions.",
    },
  ];

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-6xl">
          {/* Header */}
          <div className="text-center mb-16 space-y-6">
            <h1 className="text-4xl md:text-6xl font-bold">
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                About HerSpace
              </span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              We're on a mission to create a world where every woman feels safe, supported, and empowered to live freely
              without fear.
            </p>
          </div>

          {/* Mission Section */}
          <Card className="mb-12 bg-gradient-to-br from-primary/10 to-accent/10 border-primary/30">
            <CardHeader className="text-center">
              <Target className="h-12 w-12 mx-auto mb-4 text-primary" />
              <CardTitle className="text-3xl">Our Mission</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-center max-w-3xl mx-auto">
              <p className="text-lg text-muted-foreground leading-relaxed">
                HerSpace was born from a simple yet powerful idea: every woman deserves to feel safe and supported, no
                matter where she is or what challenges she faces. We combine cutting-edge technology with deep empathy to
                create tools that make a real difference in women's lives.
              </p>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Through emergency response systems, AI-powered emotional support, safe community spaces, and real-time
                safety mapping, we're building a comprehensive ecosystem of protection and empowerment.
              </p>
            </CardContent>
          </Card>

          {/* Vision */}
          <div className="mb-12 text-center space-y-4">
            <div className="flex justify-center mb-6">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20">
                <Eye className="h-12 w-12 text-primary" />
              </div>
            </div>
            <h2 className="text-3xl font-bold">Our Vision</h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              A world where technology serves as a shield and support system, where women can connect with verified
              communities, access immediate help when needed, and find emotional support at any time of day or night.
            </p>
          </div>

          {/* Values Grid */}
          <div className="mb-12">
            <h2 className="text-3xl font-bold text-center mb-8">Our Core Values</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {values.map((value, index) => (
                <Card
                  key={index}
                  className="bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-border/50 hover:border-primary/50 transition-all hover:shadow-[var(--glow-primary)]"
                >
                  <CardHeader>
                    <div className="p-3 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 w-fit mb-4">
                      <value.icon className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="text-xl">{value.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{value.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Team Section */}
          <Card className="bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-border/50 mb-12">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl">Our Journey</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-center max-w-3xl mx-auto">
              <p className="text-muted-foreground leading-relaxed">
                HerSpace was created by a passionate team dedicated to meaningful change. What began as a focused
                initiative has evolved into a comprehensive platform serving women worldwide.
              </p>
            </CardContent>
          </Card>

          {/* Impact Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
            {[
              { number: "10K+", label: "Active Users" },
              { number: "5K+", label: "SOS Alerts Sent" },
              { number: "50+", label: "Safe Circles" },
              { number: "24/7", label: "AI Support" },
            ].map((stat, index) => (
              <Card
                key={index}
                className="bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-border/50 text-center"
              >
                <CardContent className="pt-6">
                  <div className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-2">
                    {stat.number}
                  </div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Call to Action */}
          <Card className="bg-gradient-to-br from-primary/10 to-accent/10 border-primary/30 text-center">
            <CardContent className="py-12 space-y-6">
              <h2 className="text-3xl font-bold">Join Our Community</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Be part of a movement that's making the world safer for women everywhere. Together, we're stronger.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a href="/circles" className="inline-block">
                  <button className="px-8 py-3 rounded-lg bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold hover:shadow-[var(--glow-primary)] transition-all">
                    Join Safe Circles
                  </button>
                </a>
                <a href="/support" className="inline-block">
                  <button className="px-8 py-3 rounded-lg bg-card/40 backdrop-blur-lg border border-border/50 text-card-foreground font-semibold hover:bg-card/60 transition-all">
                    Get Support
                  </button>
                </a>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default About;
