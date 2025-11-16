import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { GraduationCap, Heart, Scale, Briefcase } from "lucide-react";

interface CategorySelectionProps {
  isOpen: boolean;
  onSelect: (category: string) => void;
  onClose?: () => void;
}

const CategorySelection = ({ isOpen, onSelect, onClose }: CategorySelectionProps) => {
  const categories = [
    {
      id: "education",
      label: "Education",
      icon: GraduationCap,
      description: "Academic documents, textbooks, research papers"
    },
    {
      id: "medical",
      label: "Medical",
      icon: Heart,
      description: "Medical reports, health documents, prescriptions"
    },
    {
      id: "legal",
      label: "Legal",
      icon: Scale,
      description: "Contracts, legal documents, agreements"
    },
    {
      id: "business",
      label: "Business",
      icon: Briefcase,
      description: "Business reports, proposals, presentations"
    }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && onClose) onClose(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">Select Document Category</DialogTitle>
          <p className="text-muted-foreground">Choose the category that best fits your PDF</p>
        </DialogHeader>
        
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {categories.map((category) => (
            <Card
              key={category.id}
              className="group cursor-pointer border-2 transition-all duration-300 hover:border-primary/50 hover:shadow-[var(--shadow-hover)]"
              onClick={() => onSelect(category.id)}
            >
              <CardContent className="p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/20">
                  <category.icon className="h-6 w-6 text-primary" />
                </div>
                
                <h3 className="mb-2 text-xl font-semibold">{category.label}</h3>
                <p className="text-sm text-muted-foreground">{category.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CategorySelection;
