import { Button } from '@/components/ui/button';
import { ArrowRight, MessageSquare } from 'lucide-react';

export const FinalCTASection = () => {
  return (
    <section id="contact" className="py-20 bg-gradient-to-b from-secondary/30 to-primary/10">
      <div className="max-w-7xl mx-auto px-6 text-center">
        <div className="card-premium max-w-4xl mx-auto">
          <h2 className="font-heading font-bold text-4xl md:text-5xl mb-6 text-gradient">
            Ready to Clip on Your Solar Potential?
          </h2>
          <p className="text-xl text-muted-foreground mb-12 max-w-3xl mx-auto">
            Join the future of solar with SolarClip™. Faster installs. Safer roofs. Smarter savings.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
            <Button 
              size="lg" 
              className="bg-primary hover:bg-primary-light text-primary-foreground font-semibold px-8 py-4 min-w-[200px]"
            >
              Get Your Quote
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            
            <Button 
              size="lg" 
              variant="outline"
              className="border-2 border-accent text-accent hover:bg-accent hover:text-accent-foreground font-semibold px-8 py-4 min-w-[200px]"
            >
              <MessageSquare className="mr-2 w-5 h-5" />
              Talk to Isabella Now
            </Button>
          </div>

          <div className="mt-12 pt-8 border-t border-border">
            <p className="text-sm text-muted-foreground">
              🚀 World's first AI-ambassador solar website • 
              ⚡ Lightweight, reversible solar mounting • 
              🏢 Perfect for commercial buildings
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};