import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Facebook, Twitter, Linkedin, Mail, MapPin, Phone } from 'lucide-react';
import clearnanoLogo from '@/assets/clearnanotech-logo.png';

export const Footer = () => {
  const quickLinks = [
    { label: 'About', href: '#about' },
    { label: 'Contact', href: '#contact' },
    { label: 'Privacy Policy', href: '#privacy' },
    { label: 'Legal', href: '#legal' },
  ];

  const socialLinks = [
    { icon: Facebook, href: '#', label: 'Facebook' },
    { icon: Twitter, href: '#', label: 'Twitter' },
    { icon: Linkedin, href: '#', label: 'LinkedIn' },
  ];

  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="md:col-span-2">
            <div className="flex items-center mb-6">
              <img 
                src={clearnanoLogo} 
                alt="ClearNanoTech" 
                className="h-8 w-auto brightness-0 invert"
              />
            </div>
            <p className="text-primary-foreground/80 mb-6 max-w-md">
              ClearNanoTech develops innovative solutions for net zero energy buildings. 
              SolarClip™ is our flagship lightweight, reversible solar mounting system.
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 text-accent" />
                <span>Luxembourg, EU</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-accent" />
                <span>info@clearnanotech.com</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-4 h-4 text-accent" />
                <span>+352 XXX XXX XXX</span>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-heading font-semibold text-lg mb-6">Quick Links</h4>
            <ul className="space-y-3">
              {quickLinks.map((link) => (
                <li key={link.label}>
                  <a 
                    href={link.href}
                    className="text-primary-foreground/80 hover:text-accent transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Language & Social */}
          <div>
            <h4 className="font-heading font-semibold text-lg mb-6">Connect</h4>
            
            {/* Language Toggle */}
            <div className="mb-6">
              <Button 
                variant="outline" 
                size="sm"
                className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground hover:text-primary"
              >
                🇬🇧 English
              </Button>
            </div>

            {/* Social Links */}
            <div className="flex gap-3">
              {socialLinks.map((social) => {
                const IconComponent = social.icon;
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    className="w-10 h-10 bg-primary-foreground/10 rounded-full flex items-center justify-center hover:bg-accent hover:text-accent-foreground transition-colors"
                    aria-label={social.label}
                  >
                    <IconComponent className="w-5 h-5" />
                  </a>
                );
              })}
            </div>
          </div>
        </div>

        <Separator className="my-12 bg-primary-foreground/20" />

        <div className="flex flex-col md:flex-row justify-between items-center text-sm text-primary-foreground/60">
          <p>© 2024 ClearNanoTech. All rights reserved.</p>
          <p className="mt-4 md:mt-0">
            SolarClip™ • World's first lightweight, reversible solar mounting system
          </p>
        </div>
      </div>
    </footer>
  );
};