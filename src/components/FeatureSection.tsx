import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Zap, Shield, Clock, Building2, DollarSign, Download } from 'lucide-react';

export const FeatureSection = () => {
  const features = [
    {
      icon: Clock,
      title: "4x Faster Installations",
      description: "More roofs per crew, more revenue",
      color: "from-blue-500 to-blue-600"
    },
    {
      icon: Shield,
      title: "Roof-Safe",
      description: "No drilling, no adhesives, no damage",
      color: "from-green-500 to-green-600"
    },
    {
      icon: Zap,
      title: "Certified Secure",
      description: "Withstands winds up to 230 km/h",
      color: "from-yellow-500 to-yellow-600"
    },
    {
      icon: Building2,
      title: "Future-Ready",
      description: "Works on heritage, leased, or weight-limited buildings",
      color: "from-purple-500 to-purple-600"
    },
    {
      icon: DollarSign,
      title: "Lowest Lifecycle Cost",
      description: "Save on install, save on removal",
      color: "from-emerald-500 to-emerald-600"
    }
  ];

  return (
    <section className="py-20 bg-background">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16 animate-fade-in-up">
          <h2 className="font-heading font-bold text-4xl lg:text-5xl mb-6">
            <span className="text-gradient">Clip On. Clip Off.</span>
            <span className="block text-foreground">Power On.</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          {features.map((feature, index) => (
            <Card key={index} className="card-premium group hover:scale-105 transition-all duration-300">
              <div className="p-6">
                <div className={`w-16 h-16 mb-4 bg-gradient-to-br ${feature.color} rounded-xl flex items-center justify-center shadow-lg`}>
                  <feature.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="font-heading font-semibold text-xl mb-3 text-foreground group-hover:text-gradient transition-colors">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </Card>
          ))}
        </div>

        {/* Call to Action */}
        <div className="text-center">
          <Button className="btn-accent group">
            <Download className="mr-2 w-5 h-5" />
            Download Comparison Guide
          </Button>
          <p className="text-sm text-muted-foreground mt-3">
            Isabella can deliver this guide directly in our chat
          </p>
        </div>
      </div>
    </section>
  );
};