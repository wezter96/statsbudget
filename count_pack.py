import struct

with open('/Users/anton/Documents/repos/your-guided-plan/.git/objects/pack/pack-2008496ec2fe3744ee4d0edb42780f39fe902d1c.idx', 'rb') as f:
    data = f.read(1032)

count = struct.unpack('>I', data[1028:1032])[0]
print(f'OBJECT_COUNT={count}')
