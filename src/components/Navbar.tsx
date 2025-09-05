import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Menu, X } from 'lucide-react';
import clearnanoLogo from '@/assets/clearnanotech-logo.png';

export const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navLinks = [
    { href: '#about', label: 'About' },
    { href: '#visualizer', label: 'Visualizer' },
    { href: '#proof', label: 'Installation Demo' },
    { href: '#pricing', label: 'Pricing' },
    { href: '#resources', label: 'Resources' },
    { href: '#contact', label: 'Contact' },
  ];

  const scrollToSection = (href: string) => {
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
    setIsMenuOpen(false);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 bg-primary shadow-lg">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <img 
              src={clearnanoLogo} 
              alt="ClearNanoTech" 
              className="h-10 w-auto min-w-[120px] sm:h-12 lg:h-14 xl:h-16 max-w-[200px] object-contain"
            />
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6">
            {navLinks.map((link) => (
              <button
                key={link.href}
                onClick={() => scrollToSection(link.href)}
                className="text-primary-foreground hover:text-accent transition-colors duration-300 font-medium"
              >
                {link.label}
              </button>
            ))}
            <Button 
              variant="default" 
              className="bg-accent hover:bg-accent-light text-accent-foreground ml-4"
              onClick={() => scrollToSection('#contact')}
            >
              Get Your Quote
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-primary-foreground hover:text-accent transition-colors"
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden bg-primary border-t border-primary-light">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {navLinks.map((link) => (
                <button
                  key={link.href}
                  onClick={() => scrollToSection(link.href)}
                  className="block w-full text-left px-3 py-2 text-primary-foreground hover:text-accent transition-colors font-medium"
                >
                  {link.label}
                </button>
              ))}
              <Button 
                variant="default" 
                className="w-full mt-2 bg-accent hover:bg-accent-light text-accent-foreground"
                onClick={() => scrollToSection('#contact')}
              >
                Get Your Quote
              </Button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};