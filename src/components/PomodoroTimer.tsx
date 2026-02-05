'use client';

import { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Coffee, Timer } from 'lucide-react';

interface PomodoroTimerProps {
  className?: string;
}

export function PomodoroTimer({ className = '' }: PomodoroTimerProps) {
  const [minutes, setMinutes] = useState(25);
  const [seconds, setSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState<'work' | 'break' | 'longBreak'>('work');
  const [session, setSession] = useState(1);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Configurações dos modos
  const modes = {
    work: { duration: 25, label: 'Foco', icon: Timer, color: 'bg-red-500' },
    break: { duration: 5, label: 'Pausa Curta', icon: Coffee, color: 'bg-green-500' },
    longBreak: { duration: 15, label: 'Pausa Longa', icon: Coffee, color: 'bg-blue-500' }
  };

  // Som de notificação (opcional - você pode substituir por um arquivo real)
  useEffect(() => {
    audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhDTuL0e+tYyUELIHK9duJNwgZZLnq559NEAxPqePxtmMcBjiS1/LNeysFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhDTuL0e+tYyUELIHK9duJNwgZZLnq559NEAxPqePxtmMcBjiS1/LNeysFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhDTuL0e+tYyUELIHK9duJNwgZZLnq559NEAxPqePxtmMcBjiS1/LNeysFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhDTuL0e+tYyUELIHK9duJNwgZZLnq559NEAxPqePxtmMcBjiS1/LNeysFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhDTuL0e+tYyUELIHK9duJNwgZZLnq559NEAxPqePxtmMcBjiS1/LNeysFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhDTuL0e+tYyUE');
  }, []);

  // Timer principal
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setSeconds(prev => {
          if (prev === 0) {
            setMinutes(prevMin => {
              if (prevMin === 0) {
                // Timer terminou
                setIsRunning(false);
                handleTimerComplete();
                return 0;
              }
              return prevMin - 1;
            });
            return 59;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning]);

  const handleTimerComplete = () => {
    // Toca som de notificação
    if (audioRef.current) {
      audioRef.current.play().catch(() => {
        // Ignorar erro se o usuário não interagiu ainda
      });
    }

    // Mostra notificação do navegador
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`${modes[mode].label} terminado!`, {
        body: mode === 'work' ? 'Hora da pausa!' : 'Hora de voltar ao trabalho!',
        icon: '/favicon.ico'
      });
    }

    // Avança para o próximo modo
    if (mode === 'work') {
      if (session % 4 === 0) {
        setMode('longBreak');
      } else {
        setMode('break');
      }
    } else {
      setMode('work');
      if (mode === 'break' || mode === 'longBreak') {
        setSession(prev => prev + 1);
      }
    }
  };

  const startTimer = () => {
    // Pede permissão para notificações
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    setIsRunning(true);
  };

  const pauseTimer = () => {
    setIsRunning(false);
  };

  const resetTimer = () => {
    setIsRunning(false);
    setMinutes(modes[mode].duration);
    setSeconds(0);
  };

  const switchMode = (newMode: 'work' | 'break' | 'longBreak') => {
    setIsRunning(false);
    setMode(newMode);
    setMinutes(modes[newMode].duration);
    setSeconds(0);
  };

  const formatTime = (mins: number, secs: number) => {
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = ((modes[mode].duration * 60 - (minutes * 60 + seconds)) / (modes[mode].duration * 60)) * 100;

  const currentModeConfig = modes[mode];
  const IconComponent = currentModeConfig.icon;

  return (
    <div className={`bg-white rounded-xl shadow-lg p-6 ${className}`}>
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-4">
          <IconComponent size={24} className="text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-800">{currentModeConfig.label}</h3>
          <span className="text-sm text-gray-500">Sessão #{session}</span>
        </div>

        {/* Timer Display */}
        <div className="relative mb-6">
          <div className={`w-48 h-48 mx-auto rounded-full ${currentModeConfig.color} flex items-center justify-center shadow-lg`}>
            <div className="bg-white rounded-full w-40 h-40 flex items-center justify-center">
              <span className="text-4xl font-mono font-bold text-gray-800">
                {formatTime(minutes, seconds)}
              </span>
            </div>
          </div>
          
          {/* Progress Ring */}
          <svg className="absolute top-0 left-1/2 transform -translate-x-1/2 w-48 h-48 -rotate-90">
            <circle
              cx="96"
              cy="96"
              r="88"
              stroke="currentColor"
              strokeWidth="8"
              fill="transparent"
              className="text-gray-200"
            />
            <circle
              cx="96"
              cy="96"
              r="88"
              stroke="currentColor"
              strokeWidth="8"
              fill="transparent"
              strokeDasharray={`${2 * Math.PI * 88}`}
              strokeDashoffset={`${2 * Math.PI * 88 * (1 - progress / 100)}`}
              className={`transition-all duration-1000 ease-in-out ${
                mode === 'work' ? 'text-red-500' : 'text-green-500'
              }`}
            />
          </svg>
        </div>

        {/* Controls */}
        <div className="flex justify-center gap-3 mb-6">
          {!isRunning ? (
            <button
              onClick={startTimer}
              className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Play size={20} />
              Iniciar
            </button>
          ) : (
            <button
              onClick={pauseTimer}
              className="flex items-center gap-2 px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
            >
              <Pause size={20} />
              Pausar
            </button>
          )}
          
          <button
            onClick={resetTimer}
            className="flex items-center gap-2 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <RotateCcw size={20} />
            Reset
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="flex justify-center gap-2">
          <button
            onClick={() => switchMode('work')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === 'work' 
                ? 'bg-red-100 text-red-800 border-2 border-red-500' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Foco (25min)
          </button>
          <button
            onClick={() => switchMode('break')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === 'break' 
                ? 'bg-green-100 text-green-800 border-2 border-green-500' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Pausa (5min)
          </button>
          <button
            onClick={() => switchMode('longBreak')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === 'longBreak' 
                ? 'bg-blue-100 text-blue-800 border-2 border-blue-500' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Pausa Longa (15min)
          </button>
        </div>
      </div>
    </div>
  );
}
