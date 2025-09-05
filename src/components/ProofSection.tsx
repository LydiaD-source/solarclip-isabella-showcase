import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Clock, Wrench, DollarSign, TrendingUp } from 'lucide-react';

export const ProofSection = () => {
  const comparisons = [
    {
      metric: "Installation Time",
      traditional: "2-3 days",
      solarclip: "4-6 hours",
      improvement: "4x faster",
      icon: Clock
    },
    {
      metric: "Roof Damage",
      traditional: "Permanent holes",
      solarclip: "Zero damage",
      improvement: "100% reversible",
      icon: Wrench
    },
    {
      metric: "Labor Cost",
      traditional: "High complexity",
      solarclip: "Simple process",
      improvement: "60% savings",
      icon: DollarSign
    },
    {
      metric: "Profit Margin",
      traditional: "Standard",
      solarclip: "Enhanced",
      improvement: "+40% revenue",
      icon: TrendingUp
    }
  ];

  return (
    <section className="py-20 bg-background">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16 animate-fade-in-up">
          <h2 className="font-heading font-bold text-4xl lg:text-5xl mb-6 text-foreground">
            Seeing is Believing.
          </h2>
          <p className="text-xl text-muted-foreground max-w-4xl mx-auto leading-relaxed mb-8">
            Watch how SolarClip™ installs 4x faster than traditional systems. 
            <span className="block mt-2 font-medium text-foreground">
              Less time on site = more profit for installers, and lower costs for building owners.
            </span>
          </p>
        </div>

        {/* Video Section */}
        <div className="max-w-4xl mx-auto mb-16">
          <Card className="card-premium overflow-hidden">
            <div className="aspect-video bg-gradient-to-br from-primary/5 to-accent/5 flex items-center justify-center relative group cursor-pointer">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/80 to-primary/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="text-center z-10">
                <div className="w-24 h-24 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mb-4 mx-auto group-hover:scale-110 transition-transform duration-300">
                  <Play className="w-12 h-12 text-white ml-1" />
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-2">Installation Demo</h3>
                <p className="text-muted-foreground">Split Screen: Traditional vs SolarClip™</p>
              </div>
            </div>
          </Card>
          <div className="text-center mt-6">
            <Button className="btn-hero">
              <Play className="mr-2 w-5 h-5" />
              Watch Installation Demo
            </Button>
          </div>
        </div>

        {/* Comparison Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {comparisons.map((item, index) => (
            <Card key={index} className="card-premium p-6 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-accent/10 to-accent/5 rounded-full flex items-center justify-center">
                <item.icon className="w-8 h-8 text-accent" />
              </div>
              <h3 className="font-heading font-semibold text-lg mb-4 text-foreground">{item.metric}</h3>
              
              <div className="space-y-3">
                <div className="p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
                  <div className="text-xs text-muted-foreground mb-1">Traditional</div>
                  <div className="font-medium text-destructive">{item.traditional}</div>
                </div>
                
                <div className="p-3 bg-accent/5 border border-accent/20 rounded-lg">
                  <div className="text-xs text-muted-foreground mb-1">SolarClip™</div>
                  <div className="font-medium text-accent">{item.solarclip}</div>
                </div>
                
                <div className="font-bold text-gradient text-sm">
                  {item.improvement}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};