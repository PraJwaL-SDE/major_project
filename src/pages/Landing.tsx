import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { MessageSquare, Globe, Volume2, Presentation, Sparkles, Zap } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";

const Landing = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: MessageSquare,
      title: "Chat with your PDFs instantly",
      description: "Ask questions and get intelligent answers from your documents"
    },
    {
      icon: Presentation,
      title: "Get interactive slide answers",
      description: "View responses in beautiful, easy-to-understand slide format"
    },
    {
      icon: Globe,
      title: "Understand answers in your native language",
      description: "Translate explanations to any language instantly"
    },
    {
      icon: Volume2,
      title: "Listen to your AI tutor explain concepts",
      description: "Hear your answers with natural text-to-speech"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header with Theme Toggle */}
      <div className="fixed right-4 top-4 z-50">
        <ThemeToggle />
      </div>

      {/* Hero Section */}
      <section className="relative overflow-hidden px-4 py-20 md:py-32">
        <div className="absolute inset-0 bg-[image:var(--gradient-hero)] opacity-10"></div>
        
        <div className="container relative mx-auto max-w-6xl text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          
          <h1 className="mb-6 bg-gradient-to-r from-primary to-accent bg-clip-text text-5xl font-bold text-transparent md:text-6xl lg:text-7xl">
            AI PDF Chatbot
          </h1>
          
          <p className="mx-auto mb-10 max-w-2xl text-xl text-muted-foreground md:text-2xl">
            Transform your PDFs into interactive conversations. Ask questions, get insights, and learn faster with AI-powered assistance.
          </p>
          
          <Button 
            size="lg" 
            onClick={() => navigate("/dashboard")}
            className="group h-14 gap-2 px-8 text-lg font-semibold shadow-lg transition-all hover:shadow-xl"
          >
            Get Started
            <Zap className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Button>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-4 py-20">
        <div className="container mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold md:text-4xl">Powerful Features</h2>
            <p className="text-lg text-muted-foreground">Everything you need to interact with your documents</p>
          </div>
          
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
            {features.map((feature, index) => (
              <Card 
                key={index} 
                className="group border-2 transition-all duration-300 hover:border-primary/50 hover:shadow-[var(--shadow-hover)]"
              >
                <CardContent className="p-8">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/20">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  
                  <h3 className="mb-3 text-xl font-semibold">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-4 py-20">
        <div className="container mx-auto max-w-4xl">
          <Card className="overflow-hidden border-2 border-primary/20 bg-[image:var(--gradient-card)]">
            <CardContent className="p-12 text-center">
              <h2 className="mb-4 text-3xl font-bold md:text-4xl">Ready to get started?</h2>
              <p className="mb-8 text-lg text-muted-foreground">
                Upload your first PDF and start chatting with AI today
              </p>
              <Button 
                size="lg" 
                onClick={() => navigate("/dashboard")}
                className="h-12 px-8 text-lg font-semibold"
              >
                Go to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
};

export default Landing;
