import { GoogleSolarMap } from '@/components/GoogleSolarMap';

export const VisualizerSection = () => {

  return (
    <section className="py-20 bg-gradient-to-b from-secondary/30 to-background">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16 animate-fade-in-up">
          <h2 className="font-heading font-bold text-4xl lg:text-5xl mb-6 text-foreground">
            See SolarClip™ on Your Roof —
            <span className="text-gradient"> Instantly.</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Find out amount of energy your roof can generate by typing property address.
            <span className="block mt-2 font-medium text-foreground">Powered by Google Solar API</span>
          </p>
        </div>

        <div className="max-w-6xl mx-auto">
          <GoogleSolarMap />
        </div>
      </div>
    </section>
  );
};