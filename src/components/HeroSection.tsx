import { Button } from '@/components/ui/button';
import { ArrowRight, Play } from 'lucide-react';

export const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-secondary to-background"></div>
      
      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 opacity-[0.02]">
        <div className="w-full h-full bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23000%22%20fill-opacity%3D%221%22%3E%3Ccircle%20cx%3D%227%22%20cy%3D%227%22%20r%3D%221%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] bg-repeat"></div>
      </div>

      {/* Hero Content Grid - Two Column Layout */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
        {/* Left Column - Hero Content */}
        <div className="lg:max-w-2xl animate-fade-in-up">
          {/* Main Headline */}
          <h1 className="font-heading font-bold text-4xl sm:text-5xl lg:text-6xl xl:text-7xl mb-6 text-foreground leading-tight text-center lg:text-left">
            The Future of
            <span className="block text-gradient">Lightweight Solar</span>
            is Here.
          </h1>

          {/* Subheadline */}
          <p className="text-lg sm:text-xl lg:text-2xl text-muted-foreground mb-8 leading-relaxed text-center lg:text-left">
            SolarClip™ — the world's first clip-on / clip-off solar mounting system. 
            <span className="font-semibold text-foreground"> Fast. Reversible. Roof-safe.</span>
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start items-center mb-12">
            <Button className="btn-hero group">
              Get Your Quote
              <ArrowRight className="ml-2 w-5 h-5 transition-transform group-hover:translate-x-1" />
            </Button>
            <Button variant="outline" className="btn-outline group">
              <Play className="mr-2 w-5 h-5" />
              See How It Works
            </Button>
          </div>

          {/* Social Proof / Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            <div className="text-center lg:text-left">
              <div className="text-3xl font-bold text-gradient mb-2">4x</div>
              <div className="text-sm text-muted-foreground">Faster Installation</div>
            </div>
            <div className="text-center lg:text-left">
              <div className="text-3xl font-bold text-gradient mb-2">80%</div>
              <div className="text-sm text-muted-foreground">More Roofs Qualified</div>
            </div>
            <div className="text-center lg:text-left">
              <div className="text-3xl font-bold text-gradient mb-2">230km/h</div>
              <div className="text-sm text-muted-foreground">Wind Resistance</div>
            </div>
          </div>
        </div>

        {/* Right Column - Reserved for Isabella (she's positioned fixed, so this provides spacing) */}
        <div className="hidden lg:block"></div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
        <div className="w-6 h-10 border-2 border-muted-foreground rounded-full flex justify-center">
          <div className="w-1 h-3 bg-muted-foreground rounded-full mt-2 animate-pulse"></div>
        </div>
      </div>
    </section>
  );
};