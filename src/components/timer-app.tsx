"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import * as Tone from "tone";
import { Play, Pause, RotateCcw, Lightbulb, Loader } from "lucide-react";
import { getTimerSuggestion } from "@/app/actions";
import { type SuggestRecipeTimerOutput } from "@/ai/flows/suggest-recipe-timer";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogAction } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

const formatTime = (timeInSeconds: number): string => {
  const minutes = Math.floor(timeInSeconds / 60);
  const seconds = timeInSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

export default function TimerApp() {
  const [minutes, setMinutes] = useState("5");
  const [seconds, setSeconds] = useState("00");
  const [totalSeconds, setTotalSeconds] = useState(300);
  const [timeLeft, setTimeLeft] = useState(300);
  const [isActive, setIsActive] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  
  const synth = useRef<Tone.Synth | null>(null);
  
  const { toast } = useToast();
  const [recipeUrl, setRecipeUrl] = useState("");
  const [suggestion, setSuggestion] = useState<SuggestRecipeTimerOutput | null>(null);
  const [isLoadingSuggestion, setIsLoadingSuggestion] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && !synth.current) {
        synth.current = new Tone.Synth().toDestination();
    }
  }, []);

  useEffect(() => {
    const mins = parseInt(minutes, 10) || 0;
    const secs = parseInt(seconds, 10) || 0;
    const newTotalSeconds = mins * 60 + secs;
    setTotalSeconds(newTotalSeconds);
    if (!isActive) {
      setTimeLeft(newTotalSeconds);
    }
  }, [minutes, seconds, isActive]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prevTime) => prevTime - 1);
      }, 1000);
    } else if (timeLeft <= 0 && isActive) {
      setIsActive(false);
      setIsFinished(true);
      if (synth.current) {
        synth.current.triggerAttackRelease("C5", "0.5");
      }
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, timeLeft]);

  const progress = useMemo(() => {
    if (totalSeconds === 0) return 0;
    return (timeLeft / totalSeconds) * 100;
  }, [timeLeft, totalSeconds]);
  
  const handleMinutesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, "");
    if (isActive) return;
    setMinutes(value);
  };
  
  const handleSecondsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, "");
    if (isActive) return;
    setSeconds(value);
  };

  const handleStartPause = () => {
    if (totalSeconds <= 0) return;
    if (timeLeft === 0) {
      setTimeLeft(totalSeconds);
    }
    setIsActive(!isActive);
  };

  const handleReset = () => {
    setIsActive(false);
    setTimeLeft(totalSeconds);
  };

  const handleGetSuggestion = async () => {
    setIsLoadingSuggestion(true);
    setSuggestion(null);
    const result = await getTimerSuggestion(recipeUrl);
    if (result.error) {
        toast({
            variant: "destructive",
            title: "Error",
            description: result.error,
        });
    } else if (result.data) {
        setSuggestion(result.data);
    }
    setIsLoadingSuggestion(false);
  };

  const handleApplySuggestion = () => {
    if (suggestion) {
        setMinutes(String(suggestion.suggestedMinutes));
        setSeconds(String(suggestion.suggestedSeconds).padStart(2, '0'));
        setIsActive(false);
        toast({
            title: "Success",
            description: `Timer set to ${suggestion.suggestedMinutes}m ${suggestion.suggestedSeconds}s.`,
        });
    }
  };

  return (
    <div className="flex flex-col items-center justify-center gap-8 p-4 md:p-8">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-headline">Simple Timer</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-6">
          <div className="relative w-full text-center">
            <div className="font-mono text-8xl font-bold tracking-tighter text-foreground">
              {formatTime(timeLeft)}
            </div>
            <Progress value={progress} className="mt-4 h-2" />
          </div>

          <div className="flex w-full items-end justify-center gap-4">
            <div className="grid w-24 gap-1.5">
              <Label htmlFor="minutes" className="text-center">Minutes</Label>
              <Input
                id="minutes"
                type="tel"
                value={minutes}
                onChange={handleMinutesChange}
                className="text-center text-lg"
                disabled={isActive}
              />
            </div>
             <span className="mb-2 text-3xl font-bold">:</span>
            <div className="grid w-24 gap-1.5">
              <Label htmlFor="seconds" className="text-center">Seconds</Label>
              <Input
                id="seconds"
                type="tel"
                value={seconds}
                onChange={handleSecondsChange}
                className="text-center text-lg"
                disabled={isActive}
              />
            </div>
          </div>

          <div className="flex w-full justify-center gap-4">
            <Button
              onClick={handleStartPause}
              className="w-32 bg-accent text-accent-foreground hover:bg-accent/90"
              size="lg"
            >
              {isActive ? <Pause /> : <Play />}
              <span className="ml-2">{isActive ? "Pause" : "Start"}</span>
            </Button>
            <Button onClick={handleReset} variant="outline" size="lg">
              <RotateCcw />
              <span className="ml-2">Reset</span>
            </Button>
          </div>
        </CardContent>
      </Card>
      
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
            <div className="flex items-center gap-2">
                <Lightbulb className="text-primary"/>
                <CardTitle className="font-headline">Smart Timer Suggestion</CardTitle>
            </div>
            <CardDescription>
                Paste a recipe URL to get a suggested timer duration.
            </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="flex gap-2">
                <Input 
                    type="url"
                    placeholder="https://example.com/recipe"
                    value={recipeUrl}
                    onChange={(e) => setRecipeUrl(e.target.value)}
                    disabled={isLoadingSuggestion}
                />
                <Button onClick={handleGetSuggestion} disabled={isLoadingSuggestion || !recipeUrl}>
                    {isLoadingSuggestion ? <Loader className="animate-spin" /> : "Get"}
                </Button>
            </div>
            {suggestion && (
                <Card className="mt-4 bg-secondary">
                    <CardHeader>
                        <CardTitle className="text-base">Suggestion Found!</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground italic">"{suggestion.reasoning}"</p>
                    </CardContent>
                    <CardFooter>
                        <Button onClick={handleApplySuggestion} className="w-full">
                            Apply {suggestion.suggestedMinutes}m {suggestion.suggestedSeconds}s
                        </Button>
                    </CardFooter>
                </Card>
            )}
        </CardContent>
      </Card>

      <AlertDialog open={isFinished} onOpenChange={setIsFinished}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Time's Up!</AlertDialogTitle>
            <AlertDialogDescription>
              Your timer for {formatTime(totalSeconds)} has finished.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogAction onClick={() => setIsFinished(false)}>
            Dismiss
          </AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
