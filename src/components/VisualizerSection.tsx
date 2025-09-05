import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, Eye, Zap, BarChart3 } from 'lucide-react';

export const VisualizerSection = () => {
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = () => {
    setIsUploading(true);
    // Simulate upload process
    setTimeout(() => setIsUploading(false), 2000);
  };

  const features = [
    { icon: Eye, text: "Accurate rooftop placement" },
    { icon: Zap, text: "Solar irradiation insights" },
    { icon: BarChart3, text: "Estimated energy generation" }
  ];

  return (
    <section className="py-20 bg-gradient-to-b from-secondary/30 to-background">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16 animate-fade-in-up">
          <h2 className="font-heading font-bold text-4xl lg:text-5xl mb-6 text-foreground">
            See SolarClip™ on Your Roof —
            <span className="text-gradient"> Instantly.</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Upload a photo of your roof and preview how SolarClip™ panels will look in real time.
            <span className="block mt-2 font-medium text-foreground">Powered by Google Solar API</span>
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <Card className="card-premium p-8">
            {/* Upload Area */}
            <div className="border-2 border-dashed border-border rounded-xl p-12 text-center mb-8 hover:border-accent/50 transition-colors">
              <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-accent/10 to-accent/5 rounded-full flex items-center justify-center">
                <Upload className="w-12 h-12 text-accent" />
              </div>
              <h3 className="font-heading font-semibold text-xl mb-3 text-foreground">
                Upload Your Roof Photo
              </h3>
              <p className="text-muted-foreground mb-6">
                Drag and drop or click to select your roof image
              </p>
              <Button 
                onClick={handleUpload}
                disabled={isUploading}
                className="btn-hero"
              >
                {isUploading ? 'Processing...' : 'Try the Visualizer Now'}
              </Button>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {features.map((feature, index) => (
                <div key={index} className="flex items-center gap-3 p-4 bg-secondary/30 rounded-lg">
                  <div className="w-10 h-10 bg-accent/10 rounded-full flex items-center justify-center">
                    <feature.icon className="w-5 h-5 text-accent" />
                  </div>
                  <span className="text-foreground font-medium">{feature.text}</span>
                </div>
              ))}
            </div>

            {/* Instructions */}
            <div className="mt-8 p-6 bg-gradient-to-r from-accent/5 to-accent/10 rounded-lg border border-accent/20">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-accent rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-white text-sm font-bold">1</span>
                </div>
                <div>
                  <h4 className="font-semibold text-foreground mb-1">Upload your roof photo</h4>
                  <p className="text-sm text-muted-foreground">Clear aerial or angled view works best</p>
                </div>
              </div>
              <div className="flex items-start gap-3 mt-4">
                <div className="w-6 h-6 bg-accent rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-white text-sm font-bold">2</span>
                </div>
                <div>
                  <h4 className="font-semibold text-foreground mb-1">See SolarClip™ installed instantly</h4>
                  <p className="text-sm text-muted-foreground">AI-powered placement with accurate shadows and sizing</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
};