import { useState } from 'react';
import { CategoryModal } from "./category-modal";
import type { ToolCategory } from '@/lib/types';

interface FooterProps {
  categories: ToolCategory[];
  onCategoryClick: (categoryId: string) => void;
  onRecommendedClick: () => void;
  onAudienceClick: (audienceId: string) => void;
}

export function Footer({ categories, onCategoryClick, onRecommendedClick, onAudienceClick }: FooterProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      {/* ── Main footer band ── */}
      <footer className="bg-primary text-primary-content">
        <div className="container mx-auto px-4 py-10 footer sm:footer-horizontal">
          <aside className="sm:col-span-2 space-y-4 max-w-md">
            <div>
              <p className="text-xl font-bold">AI Tools for Schools</p>
              <p className="text-primary-content/50 text-sm font-medium">Version 4.1 · Empowering Education</p>
            </div>
            <p className="text-primary-content/70 leading-relaxed text-sm">
              Dedicated to providing educators and students with the safest, most effective AI tools to transform the classroom experience across the TASC community.
            </p>
            <div className="flex gap-3 items-center">
              <div className="flex -space-x-2">
                <div className="w-9 h-9 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-lg">🎓</div>
                <div className="w-9 h-9 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-lg">🤖</div>
                <div className="w-9 h-9 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-lg">📚</div>
              </div>
              <span className="text-primary-content/50 text-xs font-medium">Building the future of learning</span>
            </div>
          </aside>

          <nav>
            <h6 className="footer-title opacity-60">Discovery</h6>
            <button onClick={onRecommendedClick} className="link link-hover text-sm">✨ Recommended Tools</button>
            <button onClick={() => setIsModalOpen(true)} className="link link-hover text-sm">📂 Browse Categories</button>
          </nav>

          <nav>
            <h6 className="footer-title opacity-60">Target Groups</h6>
            <button onClick={() => onAudienceClick('teachers')} className="link link-hover text-sm">👨‍🏫 For Educators</button>
            <button onClick={() => onAudienceClick('students')} className="link link-hover text-sm">🎓 For Students</button>
          </nav>
        </div>
      </footer>

      {/* ── Copyright bar ── */}
      <div className="bg-primary text-primary-content border-t border-primary-content/10 text-xs">
        <div className="container mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-primary-content/50">
          <aside className="text-center sm:text-left space-y-0.5">
            <p className="font-semibold text-primary-content/70">Anglican Schools Corporation</p>
            <p>© 2025 Anglican Schools Corporation. Licensed to TASC. All rights reserved.</p>
          </aside>
          <nav className="flex items-center gap-6">
            <a
              href="https://asc.policyconnect.com.au/module/716/page/27d1c0c4-25cc-4db8-9397-df315c697417.md"
              target="_blank"
              rel="noopener noreferrer"
              className="link link-hover"
            >
              Privacy Policy
            </a>
            <span className="w-1 h-1 rounded-full bg-primary-content/20" />
            <a
              href="https://asc.policyconnect.com.au/module/716/page/27d1c0c4-25cc-4db8-9397-df315c697417.md"
              target="_blank"
              rel="noopener noreferrer"
              className="link link-hover"
            >
              Contact Support
            </a>
          </nav>
        </div>
      </div>

      <CategoryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        categories={categories}
        onCategoryClick={onCategoryClick}
      />
    </>
  );
}
