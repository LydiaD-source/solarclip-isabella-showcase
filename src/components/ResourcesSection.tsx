import { Button } from '@/components/ui/button';
import { FileText, Download, BookOpen } from 'lucide-react';
import { QuoteForm } from '@/components/QuoteForm';

export const ResourcesSection = () => {
  const resources = [
    {
      title: "Comparison Guide: SolarClip™ vs Adhesive PV",
      description: "Detailed analysis of installation methods and long-term benefits",
      icon: FileText,
      downloadUrl: "#"
    },
    {
      title: "Subsidy & Incentives Guide for Luxembourg",
      description: "Complete overview of available government incentives and how to qualify",
      icon: BookOpen,
      downloadUrl: "#"
    },
    {
      title: "How Lightweight PV Boosts Building ROI",
      description: "Financial analysis and case studies of lightweight solar installations",
      icon: Download,
      downloadUrl: "#"
    }
  ];

  return (
    <section id="resources" className="py-20 bg-gradient-to-b from-background to-secondary/30">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="font-heading font-bold text-4xl md:text-5xl mb-6 text-gradient">
            Get the Insights.
          </h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            Download expert guides and learn how to unlock the full value of your roof with SolarClip™.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {resources.map((resource, index) => {
            const IconComponent = resource.icon;
            return (
              <div key={index} className="card-premium group hover:shadow-xl transition-all duration-300">
                <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center mb-6 group-hover:bg-accent/30 transition-colors">
                  <IconComponent className="w-8 h-8 text-accent" />
                </div>
                <h3 className="font-heading font-semibold text-xl mb-4 text-foreground">
                  {resource.title}
                </h3>
                <p className="text-muted-foreground mb-6">
                  {resource.description}
                </p>
                <Button 
                  variant="outline" 
                  className="w-full border-accent text-accent hover:bg-accent hover:text-accent-foreground"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </Button>
              </div>
            );
          })}
        </div>

        <div className="text-center card-premium max-w-2xl mx-auto">
          <h3 className="font-heading font-semibold text-2xl mb-4 text-foreground">
            Need More Information?
          </h3>
          <p className="text-muted-foreground mb-6">
            Contact our team for technical documents and detailed SolarClip™ specifications.
          </p>
          <QuoteForm>
            <Button 
              size="lg" 
              className="bg-accent hover:bg-accent-light text-accent-foreground font-semibold px-8 py-4"
            >
              Request Technical Documents
            </Button>
          </QuoteForm>
        </div>
      </div>
    </section>
  );
};