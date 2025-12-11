import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Accessibility,
  Baby,
  Briefcase,
  Building,
  DollarSign,
  FileText,
  Flag,
  GraduationCap,
  Heart,
  Home,
  MapPin,
  Scale,
  Shield,
  Sparkles,
  Stethoscope,
  Users,
  Utensils,
  Car,
  Lightbulb,
  Search,
} from "lucide-react";
import { resourceCategories } from "@/components/ClientDetailsInput";

interface RefineSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialQuery: string;
  initialCategories: string[];
  initialResourceTypes: string[];
  initialLocation: string;
  onRefineSearch: (
    query: string,
    categories: string[],
    resourceTypes: string[],
    location: string
  ) => void;
}

// Sub-categories for Local Community Resources
const communitySubcategories = [
  { id: "food", label: "Food & Nutrition", description: "Food banks, meal programs, SNAP enrollment", icon: Utensils },
  { id: "housing", label: "Housing & Shelter", description: "Emergency shelter, rental assistance, utilities", icon: Home },
  { id: "healthcare", label: "Healthcare Services", description: "Clinics, mental health, dental care", icon: Stethoscope },
  { id: "transportation", label: "Transportation", description: "Bus passes, rides, gas assistance", icon: Car },
  { id: "childcare", label: "Child Care & Education", description: "Daycare, after-school programs", icon: Baby },
  { id: "legal", label: "Legal Services", description: "Legal aid, immigration assistance", icon: Scale },
  { id: "financial", label: "Financial Assistance", description: "Cash assistance, bill payment help", icon: DollarSign },
  { id: "clothing", label: "Clothing & Household", description: "Clothing closets, furniture, household items", icon: Home },
  { id: "employment", label: "Employment Support", description: "Job search help, resume assistance", icon: Briefcase },
];

// Resource provider types
const resourceProviderTypes = [
  { id: "goodwill", label: "Goodwill Resources & Programs", description: "Job training, career services, and Goodwill-specific programs", icon: Heart },
  { id: "community", label: "Local Community Resources", description: "Food banks, shelters, community organizations, and local support", icon: Users },
  { id: "government", label: "Government Benefits", description: "SNAP, Medicaid, housing assistance, and federal/state programs", icon: Building },
];

// Additional resource types
const additionalResourceTypes = [
  { id: "job-postings", label: "Job Postings", description: "Current job openings, employment opportunities, and hiring events", icon: Briefcase },
  { id: "gcta", label: "GCTA Trainings", description: "Goodwill Career Training Academy programs and certifications", icon: GraduationCap },
  { id: "cat", label: "CAT Trainings", description: "Career Advancement Training and specialized skill development", icon: GraduationCap },
];

export function RefineSearchModal({
  open,
  onOpenChange,
  initialQuery,
  initialCategories,
  initialResourceTypes,
  initialLocation,
  onRefineSearch,
}: RefineSearchModalProps) {
  const [query, setQuery] = useState(initialQuery);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(initialCategories);
  const [selectedResourceTypes, setSelectedResourceTypes] = useState<string[]>(initialResourceTypes);
  const [location, setLocation] = useState(initialLocation);
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setQuery(initialQuery);
      setSelectedCategories(initialCategories);
      setSelectedResourceTypes(initialResourceTypes);
      setLocation(initialLocation);
      setSelectedSubcategories([]);
    }
  }, [open, initialQuery, initialCategories, initialResourceTypes, initialLocation]);

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const toggleResourceType = (type: string) => {
    setSelectedResourceTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const toggleSubcategory = (subcategoryId: string) => {
    setSelectedSubcategories((prev) =>
      prev.includes(subcategoryId)
        ? prev.filter((id) => id !== subcategoryId)
        : [...prev, subcategoryId]
    );
  };

  const handleSubmit = () => {
    // Combine selected categories and subcategories
    const allCategories = [...selectedCategories, ...selectedSubcategories];
    onRefineSearch(query, allCategories, selectedResourceTypes, location);
    onOpenChange(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      handleSubmit();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="w-5 h-5 text-blue-600" />
            Refine your search to get better results
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Query Input */}
          <div>
            <Textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe your client's needs..."
              className="min-h-[100px] text-base"
              autoFocus
            />
            <p className="text-sm text-gray-600 mt-2 flex items-center gap-1">
              <Lightbulb className="w-4 h-4" />
              Be specific: Include client's situation, barriers they face, location, timeline, and any special circumstances
            </p>
          </div>

          {/* Adjust Filters Section */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Adjust Filters:</h3>
            <p className="text-sm text-gray-600 mb-4">Select categories to refine your search</p>

            {/* Main Resource Provider Types */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
              {resourceProviderTypes.map((type) => {
                const Icon = type.icon;
                const isSelected = selectedResourceTypes.includes(type.id);
                return (
                  <button
                    key={type.id}
                    onClick={() => toggleResourceType(type.id)}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      isSelected
                        ? "border-blue-600 bg-blue-50"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Icon className={`w-5 h-5 mt-0.5 ${isSelected ? "text-blue-600" : "text-gray-600"}`} />
                      <div>
                        <div className={`font-semibold text-sm ${isSelected ? "text-blue-900" : "text-gray-900"}`}>
                          {type.label}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">{type.description}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Additional Resource Types */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {additionalResourceTypes.map((type) => {
                const Icon = type.icon;
                const isSelected = selectedResourceTypes.includes(type.id);
                return (
                  <button
                    key={type.id}
                    onClick={() => toggleResourceType(type.id)}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      isSelected
                        ? "border-blue-600 bg-blue-50"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Icon className={`w-5 h-5 mt-0.5 ${isSelected ? "text-blue-600" : "text-gray-600"}`} />
                      <div>
                        <div className={`font-semibold text-sm ${isSelected ? "text-blue-900" : "text-gray-900"}`}>
                          {type.label}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">{type.description}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sub-categories (shown when community is selected) */}
          {selectedResourceTypes.includes("community") && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Refine with sub-categories</h4>
              <p className="text-sm text-gray-700 mb-3">Local Community Resources</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {communitySubcategories.map((subcategory) => {
                  const Icon = subcategory.icon;
                  const isSelected = selectedSubcategories.includes(subcategory.id);
                  return (
                    <button
                      key={subcategory.id}
                      onClick={() => toggleSubcategory(subcategory.id)}
                      className={`p-3 rounded-lg border transition-all text-left ${
                        isSelected
                          ? "border-blue-600 bg-blue-50"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <Icon className={`w-4 h-4 mt-0.5 ${isSelected ? "text-blue-600" : "text-gray-600"}`} />
                        <div>
                          <div className={`font-medium text-sm ${isSelected ? "text-blue-900" : "text-gray-900"}`}>
                            {subcategory.label}
                          </div>
                          <div className="text-xs text-gray-600 mt-0.5">{subcategory.description}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Location Preferences */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-600" />
              Location Preferences
            </h4>
            <p className="text-sm text-gray-600 mb-3">Optional: Specify a location to find resources nearby.</p>
            <Input
              placeholder="Enter location (city, ZIP code, area, etc.)"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="border-gray-300 bg-white focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
              <Lightbulb className="w-3 h-3" />
              Examples: "Round Rock", "78701", "Austin, TX", "San Marcos"
            </p>
          </div>

          {/* Active Filters Display */}
          {(selectedResourceTypes.length > 0 || selectedSubcategories.length > 0) && (
            <div className="pt-4 border-t">
              <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-600" />
                Active Filters:
              </h4>
              <div className="text-sm text-gray-700">
                {selectedResourceTypes.length > 0 && (
                  <div>
                    <span className="font-medium">Categories:</span>{" "}
                    {selectedResourceTypes.map(type => {
                      const resourceType = [...resourceProviderTypes, ...additionalResourceTypes].find(t => t.id === type);
                      return resourceType?.label;
                    }).filter(Boolean).join(", ")}
                  </div>
                )}
                {selectedSubcategories.length > 0 && (
                  <div className="mt-1">
                    <span className="font-medium">Sub-categories:</span>{" "}
                    {selectedSubcategories.map(id => {
                      const sub = communitySubcategories.find(s => s.id === id);
                      return sub?.label;
                    }).filter(Boolean).join(", ")}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <p className="text-xs text-gray-500 mr-auto">
            Press <kbd className="px-1.5 py-0.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded">⌘</kbd> + <kbd className="px-1.5 py-0.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded">Enter</kbd> to search
          </p>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Search className="w-4 h-4 mr-2" />
            Get Better Results
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
