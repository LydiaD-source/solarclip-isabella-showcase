import { Button } from '@/components/ui/button';
import { TrendingUp, Calendar, Euro } from 'lucide-react';

export const ROISection = () => {
  return (
    <section id="roi" className="py-20 bg-gradient-to-b from-background to-secondary/30">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="font-heading font-bold text-4xl md:text-5xl mb-6 text-gradient">
            Maximize Savings. Minimize Risk.
          </h2>
          <div className="max-w-3xl mx-auto">
            <p className="text-lg text-muted-foreground mb-8">
              Solar is no longer optional. By 2028, all existing EU commercial buildings will need PV installed.
            </p>
            <p className="text-lg text-muted-foreground">
              Luxembourg offers generous subsidies for PV adoption — SolarClip™ ensures you comply easily while cutting costs.
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-12">
          <div className="card-premium text-center">
            <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Calendar className="w-8 h-8 text-accent" />
            </div>
            <h3 className="font-heading font-semibold text-xl mb-4 text-foreground">
              2028 EU Mandate
            </h3>
            <p className="text-muted-foreground">
              All existing commercial buildings must have PV systems installed by 2028
            </p>
          </div>

          <div className="card-premium text-center">
            <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Euro className="w-8 h-8 text-accent" />
            </div>
            <h3 className="font-heading font-semibold text-xl mb-4 text-foreground">
              Luxembourg Subsidies
            </h3>
            <p className="text-muted-foreground">
              Generous government incentives make SolarClip™ even more cost-effective
            </p>
          </div>

          <div className="card-premium text-center">
            <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <TrendingUp className="w-8 h-8 text-accent" />
            </div>
            <h3 className="font-heading font-semibold text-xl mb-4 text-foreground">
              Fast ROI
            </h3>
            <p className="text-muted-foreground">
              Quick installation and lower costs mean faster return on investment
            </p>
          </div>
        </div>

        <div className="text-center">
          <Button 
            size="lg" 
            className="bg-accent hover:bg-accent-light text-accent-foreground font-semibold px-8 py-4"
          >
            Check Your Subsidy Eligibility
          </Button>
          <p className="text-sm text-muted-foreground mt-4">
            Our team can explain subsidies and financing options
          </p>
        </div>
      </div>
    </section>
  );
};