import React from "react";

export function AnimatedBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 opacity-[0.35]">
      <style>{`
        @keyframes drive {
          0% { transform: translateX(-10%); }
          30% { transform: translateX(40%); }
          40% { transform: translateX(40%); }
          70% { transform: translateX(80%); }
          80% { transform: translateX(80%); }
          100% { transform: translateX(110%); }
        }
        @keyframes passenger1 {
          0%, 25% { opacity: 0; transform: translateY(10px); }
          28%, 35% { opacity: 1; transform: translateY(0); }
          38%, 100% { opacity: 0; transform: translateY(0); }
        }
        @keyframes passenger2 {
          0%, 65% { opacity: 0; transform: translateY(0); }
          68%, 75% { opacity: 1; transform: translateY(0); }
          78%, 100% { opacity: 0; transform: translateY(10px); }
        }
        @keyframes money {
          0%, 70% { opacity: 0; transform: translateY(0); }
          72%, 76% { opacity: 1; transform: translateY(-15px); }
          78%, 100% { opacity: 0; transform: translateY(-20px); }
        }
        
        .bg-road {
          position: absolute;
          bottom: 20%;
          left: 0;
          width: 100%;
          height: 3px;
          background: repeating-linear-gradient(to right, transparent, transparent 30px, var(--color-green-700) 30px, var(--color-green-700) 60px);
          opacity: 0.6;
        }

        .bg-car-container {
          position: absolute;
          bottom: 20%;
          left: -100px;
          width: 100%;
          display: flex;
          align-items: flex-end;
          animation: drive 12s ease-in-out infinite;
        }
        
        .bg-car {
          width: 70px;
          height: 32px;
          background-color: var(--color-green-500);
          border-radius: 12px 24px 6px 6px;
          position: relative;
          box-shadow: 0 -2px 14px rgba(34, 197, 94, 0.6);
        }
        
        /* Headlights */
        .bg-car::after {
          content: '';
          position: absolute;
          right: -25px;
          bottom: 6px;
          width: 40px;
          height: 8px;
          background: linear-gradient(to right, rgba(253, 224, 71, 0.9), transparent);
          filter: blur(2px);
          border-radius: 50%;
        }
        
        /* Tail lights */
        .bg-car::before {
          content: '';
          position: absolute;
          left: -6px;
          bottom: 6px;
          width: 12px;
          height: 6px;
          background: rgba(239, 68, 68, 0.8);
          filter: blur(2px);
          border-radius: 50%;
        }

        .bg-wheel {
          width: 14px;
          height: 14px;
          background-color: #1a1a2e;
          border-radius: 50%;
          position: absolute;
          bottom: -5px;
          border: 2px solid #334155;
        }
        .bg-wheel.front { right: 10px; }
        .bg-wheel.back { left: 10px; }

        .bg-point-1, .bg-point-2 {
          position: absolute;
          bottom: calc(20% + 5px);
        }
        
        .bg-point-1 { left: 40%; }
        .bg-point-2 { left: 80%; }

        .bg-passenger {
          width: 14px;
          height: 28px;
          background-color: var(--color-green-400);
          border-radius: 7px;
          box-shadow: 0 0 8px rgba(74, 222, 128, 0.4);
        }

        .bg-p1 { animation: passenger1 12s infinite; }
        .bg-p2 { animation: passenger2 12s infinite; }
        
        .bg-money {
          position: absolute;
          color: var(--color-green-400);
          font-weight: 800;
          font-size: 18px;
          text-shadow: 0 0 6px rgba(74, 222, 128, 0.6);
          animation: money 12s infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .bg-car-container, .bg-p1, .bg-p2, .bg-money {
            animation: none !important;
            display: none !important;
          }
          .bg-road {
            background: var(--color-green-700);
          }
        }
      `}</style>

      <div className="bg-road" />
      
      <div className="bg-point-1">
        <div className="bg-passenger bg-p1" />
      </div>
      
      <div className="bg-point-2">
        <div className="bg-passenger bg-p2" />
        <div className="bg-money">$</div>
      </div>

      <div className="bg-car-container">
        <div className="bg-car">
          <div className="bg-wheel back" />
          <div className="bg-wheel front" />
        </div>
      </div>
    </div>
  );
}
