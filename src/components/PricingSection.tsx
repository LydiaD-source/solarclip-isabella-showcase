import { Button } from '@/components/ui/button';
import { CheckCircle, Calculator, Shield } from 'lucide-react';

export const PricingSection = () => {
  return (
    <section id="pricing" className="py-20 bg-gradient-to-b from-secondary/30 to-background">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="font-heading font-bold text-4xl md:text-5xl mb-6 text-gradient">
            Simple. Transparent. Affordable.
          </h2>
          <div className="max-w-3xl mx-auto">
            <p className="text-lg text-muted-foreground mb-8">
              SolarClip™ systems start from <span className="text-accent font-semibold">€XXX/kWp</span>.
            </p>
            <p className="text-lg text-muted-foreground">
              Exact pricing depends on your roof type and project size — but with our fast, roof-safe installation, 
              we guarantee the lowest total project cost in the market.
            </p>
          </div>
        </div>

        <div className="card-premium max-w-4xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calculator className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-heading font-semibold text-lg mb-2 text-foreground">
                Custom Pricing
              </h3>
              <p className="text-muted-foreground text-sm">
                Tailored to your specific roof and energy needs
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-accent" />
              </div>
              <h3 className="font-heading font-semibold text-lg mb-2 text-foreground">
                All-Inclusive
              </h3>
              <p className="text-muted-foreground text-sm">
                No hidden fees, installation and materials included
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-heading font-semibold text-lg mb-2 text-foreground">
                Best Price Guarantee
              </h3>
              <p className="text-muted-foreground text-sm">
                Lowest total project cost in the market
              </p>
            </div>
          </div>

          <div className="text-center">
            <Button 
              size="lg" 
              className="bg-primary hover:bg-primary-light text-primary-foreground font-semibold px-8 py-4"
            >
              Get Your Quote
            </Button>
            <p className="text-sm text-muted-foreground mt-4">
              Contact our sales team for detailed pricing
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};