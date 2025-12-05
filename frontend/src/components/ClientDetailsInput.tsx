import React from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

export const resourceCategories = [
  {
    id: "employment",
    label: "Employment & Job Training",
    icon: Briefcase,
  },
  {
    id: "housing",
    label: "Housing & Shelter",
    icon: Home,
  },
  {
    id: "food",
    label: "Food Assistance",
    icon: Utensils,
  },
  {
    id: "transportation",
    label: "Transportation",
    icon: Car,
  },
  {
    id: "healthcare",
    label: "Healthcare & Mental Health",
    icon: Stethoscope,
  },
  {
    id: "childcare",
    label: "Childcare",
    icon: Baby,
  },
  {
    id: "financial",
    label: "Financial Assistance",
    icon: DollarSign,
  },
  {
    id: "education",
    label: "Education & GED",
    icon: GraduationCap,
  },
  {
    id: "legal",
    label: "Legal Services",
    icon: Scale,
  },
  {
    id: "substance",
    label: "Substance Abuse Treatment",
    icon: Shield,
  },
  {
    id: "disability",
    label: "Disability Services",
    icon: Accessibility,
  },
  {
    id: "veterans",
    label: "Veterans Services",
    icon: Flag,
  },
];

interface ClientDetailsInputProps {
  selectedCategories: string[];
  locationText: string;
  selectedResourceTypes: string[];
  clientDescription: string;
  loading: boolean;
  onToggleCategory: (categoryId: string) => void;
  onClearAllFilters: () => void;
  onToggleResourceType: (type: string) => void;
  onLocationChange: (location: string) => void;
  onClientDescriptionChange: (description: string) => void;
  onFindResources: () => void;
}

export function ClientDetailsInput({
  selectedCategories,
  locationText,
  selectedResourceTypes,
  clientDescription,
  loading,
  onToggleCategory,
  onClearAllFilters,
  onToggleResourceType,
  onLocationChange,
  onClientDescriptionChange,
  onFindResources,
}: ClientDetailsInputProps) {
  return (
    <>
      <div className="mb-6">
        {/* Hero Section */}
        <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
          {/* Icon Circle */}
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-purple-100">
            <Sparkles className="h-10 w-10 text-purple-600" strokeWidth={2.5} />
          </div>

          {/* Heading */}
          <h1 className="mb-4 max-w-4xl text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Let's Find the Right Resources for Your Clients
          </h1>

          {/* Description */}
          <p className="max-w-2xl text-lg text-gray-600 mb-6">
            Share some details about your client's situation, and we'll help you discover the right resources and referrals tailored to their specific needs.
          </p>
        </div>

        {/* Input Section */}
        <div data-testid={"clientDescriptionInputSection"}>
          <Label
            className="font-medium text-gray-900 text-lg mb-3"
            htmlFor="clientDescriptionInput"
          >
            Tell us about your client
          </Label>
          <Textarea
            placeholder="Add details about the client's specific situation, needs, and circumstances here..."
            id="clientDescriptionInput"
            value={clientDescription}
            onChange={(e) => onClientDescriptionChange(e.target.value)}
            className="min-h-[10rem] min-w-[16rem] text-base py-3 px-4"
            data-testid="clientDescriptionInput"
          />
        </div>
      </div>

      <Card
        className="bg-gray-50 border-gray-200"
        data-testid="referralFiltersSection"
      >
        <CardContent className="p-6 space-y-6">
          {/* Resource Categories */}
          <div>
            <h2 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              Focus on Specific Resource Types
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {resourceCategories.map((category) => {
                const Icon = category.icon;
                const isSelected = selectedCategories.includes(category.id);
                return (
                  <Button
                    key={category.id}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    className={`text-base flex-col justify-center px-3 py-3 min-h-24 w-auto whitespace-normal break-words h-auto ${
                      isSelected
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                    onClick={() => onToggleCategory(category.id)}
                    data-testid={"resourceCategoryToggle-" + category.id}
                    aria-pressed={isSelected}
                  >
                    <Icon className="mr-2 w-6 h-6" />
                    {category.label}
                  </Button>
                );
              })}
            </div>
          </div>

          <div>
            <h2 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
              <Building className="w-4 h-4 text-blue-600" />
              Resource Provider Types
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button
                variant={
                  selectedResourceTypes.includes("goodwill")
                    ? "default"
                    : "outline"
                }
                size="sm"
                className={`h-14 text-base px-4 ${
                  selectedResourceTypes.includes("goodwill")
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
                onClick={() => onToggleResourceType("goodwill")}
                data-testid={"resourceCategoryToggle-goodwill"}
                aria-pressed={selectedResourceTypes.includes("goodwill")}
              >
                <Heart className="w-4 h-4 mr-2" />
                Goodwill Internal
              </Button>
              <Button
                variant={
                  selectedResourceTypes.includes("government")
                    ? "default"
                    : "outline"
                }
                size="sm"
                className={`h-14 text-base px-4 ${
                  selectedResourceTypes.includes("government")
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
                onClick={() => onToggleResourceType("government")}
                data-testid={"resourceCategoryToggle-government"}
                aria-pressed={selectedResourceTypes.includes("government")}
              >
                <Building className="w-4 h-4 mr-2" />
                Government
              </Button>
              <Button
                variant={
                  selectedResourceTypes.includes("community")
                    ? "default"
                    : "outline"
                }
                size="sm"
                className={`h-14 text-base px-4 ${
                  selectedResourceTypes.includes("community")
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
                onClick={() => onToggleResourceType("community")}
                data-testid={"resourceCategoryToggle-community"}
                aria-pressed={selectedResourceTypes.includes("community")}
              >
                <Users className="w-4 h-4 mr-2" />
                Community
              </Button>
            </div>
          </div>

          {/* Location Filters */}
          <div>
            <h2 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-600" />
              Location Preferences
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-1 gap-3">
              <Input
                placeholder="Enter location (city, area, zip code, etc.)"
                value={locationText}
                onChange={(e) => onLocationChange(e.target.value)}
                className="border-gray-300 bg-white focus:ring-blue-500 focus:border-blue-500 h-12 text-base"
                data-testid="locationFilterInput"
              />
            </div>
          </div>

          {/* Clear All Button */}
          {(selectedCategories.length > 0 ||
            selectedResourceTypes.length > 0 ||
            locationText) && (
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearAllFilters}
                className="text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                data-testid="clearFiltersButton"
              >
                Clear All Filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-2">
        <Button
          type="button"
          onClick={onFindResources}
          disabled={
            loading ||
            (selectedCategories.length === 0 && !clientDescription.trim())
          }
          className="min-w-[16rem] w-full row-auto generate-referrals-button text-lg pt-6 pb-6"
          data-testid="findResourcesButton"
          aria-busy={loading}
          aria-live="polite"
        >
          {!loading && (
            <>
              <Sparkles className="w-5 h-5" aria-hidden="true" /> Find Resources
            </>
          )}
          {loading && (
            <>
              <Spinner className="w-5 h-5" aria-hidden="true" />
              Generating Resources...
            </>
          )}
        </Button>
        {!loading && selectedCategories.length === 0 && !clientDescription.trim() && (
          <p className="text-center text-gray-600 text-base">
            Please describe your client's situation above or select at least one resource category to continue
          </p>
        )}
      </div>
    </>
  );
}
