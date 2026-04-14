from rest_framework.throttling import ScopedRateThrottle


class WindowScopedRateThrottle(ScopedRateThrottle):
    @classmethod
    def parse_rate(cls, rate):
        if rate is None:
            return (None, None)

        num, period = rate.split("/")
        base_period = period.strip().lower()

        multiplier = 1
        if base_period and base_period[0].isdigit():
            digit_index = 0
            while digit_index < len(base_period) and base_period[digit_index].isdigit():
                digit_index += 1
            multiplier = int(base_period[:digit_index])
            base_period = base_period[digit_index:]

        durations = {
            "s": 1,
            "sec": 1,
            "second": 1,
            "seconds": 1,
            "m": 60,
            "min": 60,
            "minute": 60,
            "minutes": 60,
            "h": 3600,
            "hour": 3600,
            "hours": 3600,
            "d": 86400,
            "day": 86400,
            "days": 86400,
        }

        duration = durations[base_period] * multiplier
        return int(num), duration
