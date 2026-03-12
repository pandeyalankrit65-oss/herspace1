import { Link } from "react-router-dom";
import { Shield, Heart, Users, AlertCircle, MessageCircle, Map, Building2, Quote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import heroImage from "@/assets/hero-safety.jpg";

const Index = () => {
  const features = [
    {
      icon: AlertCircle,
      title: "Instant SOS Alerts",
      description: "One-tap emergency alerts with real-time location tracking sent to trusted contacts.",
      link: "/sos",
    },
    {
      icon: Shield,
      title: "Report Incidents",
      description: "Securely report incidents with optional anonymity and verified ID protection.",
      link: "/report",
    },
    {
      icon: MessageCircle,
      title: "AI-Powered Support",
      description: "24/7 emotional support and harassment detection through compassionate AI.",
      link: "/support",
    },
    {
      icon: Map,
      title: "Safe Zone Mapping",
      description: "Community-mapped safe spaces and real-time location safety insights.",
      link: "/map",
    },
    {
      icon: Building2,
      title: "Corporate Connect",
      description: "Secure workplace incident reporting with verified HR channel access.",
      link: "/corporate",
    },
    {
      icon: Users,
      title: "Community Circles",
      description: "Join verified communities for support, sharing experiences, and connection.",
      link: "/circles",
    },
  ];

  const testimonials = [
    {
      quote: "Women who seek to be equal with men lack ambition. But we seek to be safe, heard, and empowered.",
      author: "HerSpace Community",
    },
    {
      quote: "Safety isn't just about feeling secure—it's about having the tools and community to ensure it.",
      author: "Platform Vision",
    },
    {
      quote: "Every woman deserves to walk freely without fear. Together, we make that possible.",
      author: "Community Member",
    },
  ];

  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero Section */}
      <section
        className="relative px-4 overflow-hidden min-h-[80vh] md:min-h-[90vh] pt-32 pb-24 md:pt-40 md:pb-40"
        style={{
          background: "var(--gradient-hero)",
        }}
      >
        <div className="absolute inset-0 opacity-60">
          <img src={heroImage} alt="Women Standing Together" className="w-full h-full object-cover object-center" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/20 to-background/80" />
        
        <div className="container mx-auto relative z-10">
          <div className="max-w-4xl mx-auto text-center space-y-8 animate-fade-in mt-28 md:mt-40">
            <h1 className="text-5xl md:text-7xl font-bold leading-tight">
              <span className="bg-gradient-to-r from-primary via-accent to-cyan bg-clip-text text-transparent">
                Empowering Women
              </span>
              <br />
              <span className="text-foreground">Through Safety, Support & Community</span>
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Building a safer digital world where every woman has access to instant help, trusted support, and a community that stands together.
            </p>
            <div className="flex flex-col sm:flex-row gap-6 justify-center pt-4">
              <Link to="/corporate">
                <Button variant="hero" size="xl" className="gap-2 text-lg px-12 transition-all hover:scale-105">
                  <Building2 className="h-6 w-6" />
                  Corporate Connect
                </Button>
              </Link>
              <Link to="/circles">
                <Button variant="glass" size="xl" className="gap-2 text-lg px-12 transition-all hover:scale-105">
                  <Users className="h-6 w-6" />
                  Connect to Circles
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Mission Statement */}
      <section className="py-20 px-4 bg-gradient-to-b from-card/40 to-background">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center space-y-8">
            <h2 className="text-4xl md:text-5xl font-bold mb-8">
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Our Mission
              </span>
            </h2>
            <div className="grid md:grid-cols-2 gap-8 text-left">
              <Card className="bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-border/50 hover:border-primary/50 transition-all hover:scale-105 duration-300">
                <CardContent className="p-8 space-y-4">
                  <Shield className="h-12 w-12 text-primary mb-4" />
                  <h3 className="text-2xl font-bold">Prevent Harassment</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Leveraging AI-powered detection and community reporting to identify and prevent harassment before it
                    escalates. Creating safer spaces both online and offline.
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-border/50 hover:border-primary/50 transition-all hover:scale-105 duration-300">
                <CardContent className="p-8 space-y-4">
                  <Heart className="h-12 w-12 text-primary mb-4" />
                  <h3 className="text-2xl font-bold">Connect with Help</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Instant access to emergency services, verified counselors, and trusted community members. Help is
                    always just one tap away, 24/7.
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-border/50 hover:border-primary/50 transition-all hover:scale-105 duration-300">
                <CardContent className="p-8 space-y-4">
                  <Users className="h-12 w-12 text-primary mb-4" />
                  <h3 className="text-2xl font-bold">Empower Community</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Building verified circles where women can share experiences, support each other, and create lasting
                    connections in safe, moderated spaces.
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-border/50 hover:border-primary/50 transition-all hover:scale-105 duration-300">
                <CardContent className="p-8 space-y-4">
                  <Building2 className="h-12 w-12 text-primary mb-4" />
                  <h3 className="text-2xl font-bold">Secure Digital Spaces</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    End-to-end encryption, verified identity protection, and fake account reporting to ensure every
                    interaction is safe and authentic.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Corporate Connect Section */}
      <section className="py-20 px-4 bg-gradient-to-br from-primary/10 via-accent/5 to-background">
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="inline-block p-4 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20">
                <Building2 className="h-12 w-12 text-primary" />
              </div>
              <h2 className="text-4xl md:text-5xl font-bold">
                <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  Corporate Connect
                </span>
              </h2>
              <p className="text-xl text-muted-foreground leading-relaxed">
                Empowering women in workplaces to safely report incidents, connect with verified HR channels, and
                access professional counseling—all with complete confidentiality.
              </p>
              <ul className="space-y-4">
                {[
                  "Anonymous workplace incident reporting",
                  "Direct connection to verified HR departments",
                  "Professional counselor access",
                  "End-to-end encrypted communications",
                ].map((item, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <span className="text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
              <Link to="/corporate">
                <Button variant="hero" size="lg" className="gap-2 mt-4">
                  <Building2 className="h-5 w-5" />
                  Explore Corporate Connect
                </Button>
              </Link>
            </div>
            <Card className="bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-primary/30 hover:shadow-[var(--glow-primary)] transition-all">
              <CardContent className="p-8 space-y-6">
                <h3 className="text-2xl font-bold">Why It Matters</h3>
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center">
                      <Shield className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">Safe Reporting</h4>
                      <p className="text-sm text-muted-foreground">
                        Report incidents without fear of retaliation or exposure
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center">
                      <Heart className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">Professional Support</h4>
                      <p className="text-sm text-muted-foreground">
                        Access to trained counselors and HR professionals
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">Culture Change</h4>
                      <p className="text-sm text-muted-foreground">
                        Building safer, more inclusive workplace environments
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-4">
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Key Features</span>
          </h2>
          <p className="text-center text-muted-foreground mb-12 text-lg">
            Comprehensive tools for safety, support, and community empowerment
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Link key={index} to={feature.link}>
                <Card className="group h-full bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-border/50 hover:border-primary/50 transition-all hover:shadow-[var(--glow-primary)] cursor-pointer hover:scale-105 duration-300">
                  <CardContent className="p-6 space-y-4">
                    <div className="p-3 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 w-fit group-hover:shadow-[var(--glow-primary)] transition-all">
                      <feature.icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold text-foreground group-hover:text-primary transition-colors">
                      {feature.title}
                    </h3>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials / Awareness Quotes */}
      <section className="py-20 px-4 bg-gradient-to-b from-background to-card/40">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-4">
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Voices of Empowerment
            </span>
          </h2>
          <p className="text-center text-muted-foreground mb-12 text-lg">
            Inspiring messages about women's safety and empowerment
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card
                key={index}
                className="bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-border/50 hover:border-primary/50 transition-all hover:shadow-[var(--glow-primary)] hover:scale-105 duration-300"
              >
                <CardContent className="p-8 space-y-4">
                  <Quote className="h-10 w-10 text-primary/50" />
                  <p className="text-lg italic text-muted-foreground leading-relaxed">"{testimonial.quote}"</p>
                  <p className="text-sm font-semibold text-primary">— {testimonial.author}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-br from-primary/10 to-accent/10">
        <div className="container mx-auto max-w-4xl text-center space-y-8">
          <h2 className="text-4xl md:text-5xl font-bold">
            Ready to Join Our{" "}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Community?</span>
          </h2>
          <p className="text-xl text-muted-foreground leading-relaxed">
            Be part of a movement building a safer digital world for women everywhere. Together, we're stronger.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/circles">
              <Button variant="hero" size="lg" className="gap-2">
                <Users className="h-5 w-5" />
                Join Safe Circles
              </Button>
            </Link>
            <Link to="/about">
              <Button variant="glass" size="lg">Learn More About Us</Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Index;
