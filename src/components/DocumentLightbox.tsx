import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, ZoomIn, ZoomOut, Download, ChevronLeft, ChevronRight } from 'lucide-react';

interface DocumentLightboxProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
  fileName: string;
  contentType: string;
}

export default function DocumentLightbox({ open, onOpenChange, url, fileName, contentType }: DocumentLightboxProps) {
  const [zoom, setZoom] = useState(1);
  const isImage = contentType?.startsWith('image/');
  const isPdf = contentType === 'application/pdf';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-background/95 backdrop-blur-sm border-border overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
          <p className="text-sm font-medium text-foreground truncate">{fileName}</p>
          <div className="flex items-center gap-1">
            {isImage && (
              <>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(z => Math.max(0.25, z - 0.25))}>
                  <ZoomOut className="h-3.5 w-3.5" />
                </Button>
                <span className="text-xs text-muted-foreground w-10 text-center">{Math.round(zoom * 100)}%</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(z => Math.min(3, z + 0.25))}>
                  <ZoomIn className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => window.open(url, '_blank')}>
              <Download className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onOpenChange(false)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-auto flex items-center justify-center min-h-[60vh] max-h-[80vh] bg-muted/20">
          {isImage ? (
            <img
              src={url}
              alt={fileName}
              className="transition-transform duration-200"
              style={{ transform: `scale(${zoom})`, maxWidth: zoom <= 1 ? '100%' : 'none' }}
            />
          ) : isPdf ? (
            <iframe src={url} className="w-full h-[80vh] border-0" title={fileName} />
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-sm">Preview not available for this file type.</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => window.open(url, '_blank')}>
                <Download className="h-4 w-4 mr-2" />Download File
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
