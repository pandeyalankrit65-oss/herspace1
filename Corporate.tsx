import { Building2, ShieldCheck, UserCheck, FileText, MessageCircle, Lock, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Link } from "react-router-dom";

const Corporate = () => {
  const features = [
    {
      icon: ShieldCheck,
      title: "Verified HR Channels",
      description: "Direct, secure connection to verified HR departments and workplace counselors.",
    },
    {
      icon: UserCheck,
      title: "Anonymous Reporting",
      description: "Report workplace incidents anonymously while maintaining complete confidentiality.",
    },
    {
      icon: FileText,
      title: "Documentation Support",
      description: "Secure storage and management of incident reports with legal compliance.",
    },
    {
      icon: Lock,
      title: "End-to-End Encryption",
      description: "All communications and reports are encrypted and protected by enterprise-grade security.",
    },
  ];

  return (
    <div className="min-h-screen">
      <Navbar />

      <main className="pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-6xl">
          {/* Hero Section */}
          <div className="text-center mb-16 space-y-6 animate-fade-in">
            <div className="inline-block p-4 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 mb-4">
              <Building2 className="h-16 w-16 text-primary" />
            </div>
            <h1 className="text-4xl md:text-6xl font-bold">
              <span className="bg-gradient-to-r from-primary via-accent to-cyan bg-clip-text text-transparent">
                Corporate Connect
              </span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              A secure platform for women in workplaces to report incidents, connect with verified HR channels, and
              access professional counseling services.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/report">
                <Button variant="hero" size="xl" className="gap-2 animate-glow-pulse">
                  <FileText className="h-5 w-5" />
                  Report Workplace Incident
                </Button>
              </Link>
              <Button variant="glass" size="xl" className="gap-2">
                <MessageCircle className="h-5 w-5" />
                Connect with HR
              </Button>
            </div>
          </div>

          {/* Why Corporate Connect */}
          <section className="mb-16">
            <Card className="bg-gradient-to-br from-primary/10 to-accent/10 border-primary/30">
              <CardHeader className="text-center">
                <CardTitle className="text-3xl">Why Corporate Connect?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-center max-w-3xl mx-auto">
                <p className="text-lg text-muted-foreground leading-relaxed">
                  Workplace harassment and discrimination remain significant challenges for women professionals.
                  Corporate Connect provides a safe, verified, and confidential channel to report incidents, seek
                  support, and connect with appropriate resources within your organization.
                </p>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  Our platform ensures your voice is heard while protecting your identity and maintaining complete
                  confidentiality throughout the process.
                </p>
              </CardContent>
            </Card>
          </section>

          {/* Features Grid */}
          <section className="mb-16">
            <h2 className="text-3xl font-bold text-center mb-12">
              How We <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Support You</span>
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              {features.map((feature, index) => (
                <Card
                  key={index}
                  className="group bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-border/50 hover:border-primary/50 transition-all hover:shadow-[var(--glow-primary)] hover:scale-105 duration-300"
                >
                  <CardHeader>
                    <div className="p-3 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 w-fit mb-4 group-hover:shadow-[var(--glow-primary)] transition-all">
                      <feature.icon className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="text-xl">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-base">{feature.description}</CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* How It Works */}
          <section className="mb-16">
            <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  step: "01",
                  title: "Verify Your Identity",
                  description: "Use your corporate email or employee ID to verify your workplace affiliation securely.",
                },
                {
                  step: "02",
                  title: "Report or Connect",
                  description: "Submit an incident report or request connection with HR representatives and counselors.",
                },
                {
                  step: "03",
                  title: "Get Support",
                  description: "Receive professional guidance, follow up on your case, and access workplace resources.",
                },
              ].map((item, index) => (
                <div key={index} className="text-center space-y-4">
                  <div className="text-5xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    {item.step}
                  </div>
                  <h3 className="text-xl font-semibold">{item.title}</h3>
                  <p className="text-muted-foreground">{item.description}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Corporate Partners CTA */}
          <section className="mb-16">
            <Card className="bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm border-border/50">
              <CardHeader className="text-center">
                <Building2 className="h-12 w-12 mx-auto mb-4 text-primary" />
                <CardTitle className="text-2xl">For Corporate Partners</CardTitle>
                <CardDescription>
                  Integrate HerSpace into your workplace to provide employees with secure reporting channels
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <h4 className="font-semibold flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-primary" />
                      Compliance & Security
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Meet legal requirements with enterprise-grade security and audit trails
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold flex items-center gap-2">
                      <UserCheck className="h-5 w-5 text-primary" />
                      Employee Trust
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Build a safer workplace culture with transparent reporting mechanisms
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button variant="hero" size="lg" className="gap-2">
                    <Phone className="h-5 w-5" />
                    Schedule a Demo
                  </Button>
                  <Button variant="glass" size="lg" className="gap-2">
                    <Mail className="h-5 w-5" />
                    Contact Sales
                  </Button>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Emergency Support */}
          <Card className="bg-gradient-to-br from-destructive/10 to-red-900/10 border-destructive/30">
            <CardHeader>
              <CardTitle>Need Immediate Help?</CardTitle>
              <CardDescription>
                If you're experiencing an emergency or immediate threat in the workplace
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <Link to="/sos" className="flex-1">
                  <Button variant="emergency" size="lg" className="w-full">
                    Emergency SOS
                  </Button>
                </Link>
                <Link to="/support" className="flex-1">
                  <Button variant="hero" size="lg" className="w-full">
                    AI Support Chat
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Corporate;
