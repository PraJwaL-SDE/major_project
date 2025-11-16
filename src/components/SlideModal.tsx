import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface SlideModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
}

const SlideModal = ({ isOpen, onClose, content }: SlideModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Interactive Slide View</DialogTitle>
        </DialogHeader>
        <div className="mt-4 rounded-lg bg-gradient-to-br from-primary/10 to-accent/10 p-12">
          <div className="prose prose-lg dark:prose-invert max-w-none">
            <div className="mb-6 text-center">
              <div className="mb-4 inline-block rounded-full bg-primary/20 px-4 py-2">
                <span className="text-sm font-semibold text-primary">AI Generated Answer</span>
              </div>
            </div>
            <div className="rounded-xl bg-card p-8 shadow-lg">
              <p className="text-lg leading-relaxed">{content}</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SlideModal;
