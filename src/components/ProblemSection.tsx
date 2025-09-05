import { Card } from '@/components/ui/card';
import { AlertTriangle, Building, Wrench, DollarSign } from 'lucide-react';

export const ProblemSection = () => {
  const problems = [
    {
      icon: Building,
      title: "80% of Roofs Disqualified",
      description: "Most commercial roofs can't handle heavy traditional panels"
    },
    {
      icon: Wrench,
      title: "Roof Damage Risk",
      description: "Drilling, adhesives, and mounting cause permanent damage"
    },
    {
      icon: DollarSign,
      title: "High Installation Costs",
      description: "Complex mounting systems require costly reinforcement"
    },
    {
      icon: AlertTriangle,
      title: "Missed Opportunities",
      description: "Wasted roof space means lost energy savings potential"
    }
  ];

  return (
    <section className="py-20 bg-gradient-to-b from-background to-secondary/30">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16 animate-fade-in-up">
          <h2 className="font-heading font-bold text-4xl lg:text-5xl mb-6 text-foreground">
            Unlock Solar for Every Roof.
          </h2>
          <div className="max-w-4xl mx-auto text-lg text-muted-foreground leading-relaxed space-y-4">
            <p>
              Up to <span className="font-semibold text-foreground">80% of commercial roofs</span> can't handle heavy solar panels. 
              Traditional solutions require drilling, adhesives, or costly reinforcement. That means wasted roof space and missed energy savings.
            </p>
            <p className="text-xl font-medium text-gradient">
              SolarClip™ changes everything with a lightweight, reversible system that installs in hours — no roof damage, no glue, no delays.
            </p>
          </div>
        </div>

        {/* Problem Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {problems.map((problem, index) => (
            <Card key={index} className="card-premium text-center p-6 hover:scale-105 transition-transform duration-300">
              <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-destructive/10 to-destructive/5 rounded-full flex items-center justify-center">
                <problem.icon className="w-8 h-8 text-destructive" />
              </div>
              <h3 className="font-heading font-semibold text-lg mb-2 text-foreground">{problem.title}</h3>
              <p className="text-sm text-muted-foreground">{problem.description}</p>
            </Card>
          ))}
        </div>

        {/* Solution Preview */}
        <div className="mt-16 text-center">
          <div className="inline-flex items-center gap-4 bg-gradient-to-r from-accent/10 to-accent/5 border border-accent/20 rounded-full px-8 py-4">
            <div className="w-12 h-12 bg-gradient-to-br from-accent to-accent-light rounded-full flex items-center justify-center">
              <span className="text-2xl">⚡</span>
            </div>
            <div className="text-left">
              <div className="font-semibold text-foreground">SolarClip™ Solution</div>
              <div className="text-sm text-muted-foreground">Revolutionary clip-on system</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};